import os
import re
import json
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from docx import Document
from docx.oxml.ns import qn

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
CONFIG_PATH = BASE_DIR / "config.json"
DB_PATH = BASE_DIR / "database.db"

TEMPLATE_MAP = {
    "E40": "«NR»_ACCORDO QUADRO_«STU»_SOSTITUZIONE RIPARTITORI CALORE OMS_E40.docx",
    "Q55": "«NR»_ACCORDO QUADRO_«STU»_SOSTITUZIONE RIPARTITORI CALORE OMS_Q5.55.docx",
}


# ── Database ─────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS offerte (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero INTEGER,
            nome_studio TEXT,
            nome_condominio TEXT,
            via TEXT,
            cap TEXT,
            citta TEXT,
            riferimento TEXT,
            template TEXT,
            prezzo_fornitura REAL,
            prezzo_care REAL,
            canone_lettura REAL,
            modalita TEXT DEFAULT 'vendita',
            totale REAL,
            stato TEXT DEFAULT 'richiamato',
            email_studio TEXT,
            data_creazione DATETIME,
            path_docx TEXT,
            path_pdf TEXT,
            note TEXT
        );
        CREATE TABLE IF NOT EXISTS clienti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_studio TEXT,
            via TEXT,
            cap TEXT,
            citta TEXT,
            email TEXT,
            telefono TEXT,
            referente TEXT,
            note TEXT,
            data_inserimento DATETIME
        );
    """)
    conn.commit()
    conn.close()


# ── Config ───────────────────────────────────────────────────────────

def read_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_config(data):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Word helpers ─────────────────────────────────────────────────────

def replace_runs(paragraphs, old, new):
    for p in paragraphs:
        for r in p.runs:
            if old in r.text:
                r.text = r.text.replace(old, new)


def replace_xml(element, old, new):
    for t in element.iter(qn("w:t")):
        if t.text and old in t.text:
            t.text = t.text.replace(old, new)


def studio_slug(name):
    words = re.sub(r"[^A-Za-z0-9 ]", "", name).split()
    slug = "_".join(words[:3]).upper()
    return slug[:30]


def format_eur(val):
    if val is None:
        return "—"
    return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ── Routes ───────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── API: Config ──────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET"])
def api_config_get():
    cfg = read_config()
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM offerte").fetchone()[0]
    conn.close()
    cfg["totale_offerte_generate"] = total
    return jsonify(cfg)


@app.route("/api/config", methods=["POST"])
def api_config_post():
    data = request.json
    cfg = read_config()
    if "prossimo_numero" in data:
        cfg["prossimo_numero"] = int(data["prossimo_numero"])
    write_config(cfg)
    return jsonify({"ok": True})


# ── API: Offerte ─────────────────────────────────────────────────────

@app.route("/api/offerte", methods=["GET"])
def api_offerte_list():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM offerte ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/offerte", methods=["POST"])
def api_offerte_create():
    data = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO offerte
           (nome_studio, nome_condominio, via, cap, citta, riferimento,
            template, prezzo_fornitura, prezzo_care, canone_lettura,
            modalita, totale, stato, email_studio, data_creazione, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            data.get("nome_studio", ""),
            data.get("nome_condominio", ""),
            data.get("via", ""),
            data.get("cap", ""),
            data.get("citta", ""),
            data.get("riferimento", ""),
            data.get("template", ""),
            data.get("prezzo_fornitura"),
            data.get("prezzo_care"),
            data.get("canone_lettura"),
            data.get("modalita", "vendita"),
            data.get("totale"),
            data.get("stato", "richiamato"),
            data.get("email_studio", ""),
            now,
            data.get("note", ""),
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM offerte WHERE id=?", (new_id,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/api/offerte/<int:oid>", methods=["PUT"])
def api_offerte_update(oid):
    data = request.json
    conn = get_db()
    row = conn.execute("SELECT * FROM offerte WHERE id=?", (oid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Non trovata"}), 404

    allowed = [
        "nome_studio", "nome_condominio", "via", "cap", "citta",
        "riferimento", "template", "prezzo_fornitura", "prezzo_care",
        "canone_lettura", "modalita", "totale", "stato", "email_studio",
        "note", "path_docx", "path_pdf", "numero",
    ]
    sets = []
    vals = []
    for k in allowed:
        if k in data:
            sets.append(f"{k}=?")
            vals.append(data[k])
    if sets:
        vals.append(oid)
        conn.execute(f"UPDATE offerte SET {','.join(sets)} WHERE id=?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM offerte WHERE id=?", (oid,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.route("/api/offerte/<int:oid>/stato", methods=["PUT"])
def api_offerte_stato(oid):
    data = request.json
    conn = get_db()
    conn.execute("UPDATE offerte SET stato=? WHERE id=?", (data["stato"], oid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/offerte/<int:oid>", methods=["DELETE"])
def api_offerte_delete(oid):
    conn = get_db()
    conn.execute("DELETE FROM offerte WHERE id=?", (oid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── API: Genera ──────────────────────────────────────────────────────

@app.route("/api/genera", methods=["POST"])
def api_genera():
    data = request.json
    oid = data.get("id")
    conn = get_db()
    row = conn.execute("SELECT * FROM offerte WHERE id=?", (oid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Offerta non trovata"}), 404
    off = dict(row)

    # Validate required fields
    missing = []
    for f in ["nome_studio", "template", "prezzo_fornitura", "prezzo_care", "canone_lettura"]:
        if not off.get(f) and off.get(f) != 0:
            missing.append(f)
    if missing:
        conn.close()
        return jsonify({"error": f"Campi obbligatori mancanti: {', '.join(missing)}"}), 400

    template_key = off["template"]
    if template_key not in TEMPLATE_MAP:
        conn.close()
        return jsonify({"error": f"Template sconosciuto: {template_key}"}), 400

    # Assign number
    cfg = read_config()
    if not off.get("numero"):
        numero = cfg["prossimo_numero"]
        cfg["prossimo_numero"] = numero + 1
        write_config(cfg)
    else:
        numero = off["numero"]

    slug = studio_slug(off["nome_studio"])
    tipo = template_key
    anno = datetime.now().strftime("%Y")
    folder_name = f"{numero}_{slug}_{tipo}"
    dest_dir = OUTPUT_DIR / anno / folder_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    file_base = f"ULTERIA_{numero}_{slug}_{tipo}"
    docx_name = f"{file_base}.docx"
    docx_path = dest_dir / docx_name

    # Copy template
    src = UPLOADS_DIR / TEMPLATE_MAP[template_key]
    shutil.copy2(str(src), str(docx_path))

    # Open and replace
    doc = Document(str(docx_path))

    via_studio = off.get("via", "") or ""
    citta_studio = off.get("citta", "") or ""
    if via_studio and citta_studio:
        via_full = f"{via_studio}, {citta_studio}"
    else:
        via_full = via_studio or citta_studio

    dat_str = datetime.now().strftime("Cernusco Lomb.ne, %d/%m/%Y")

    pfo = format_eur(off.get("prezzo_fornitura"))
    pca = format_eur(off.get("prezzo_care"))
    pcl = format_eur(off.get("canone_lettura"))
    modalita = off.get("modalita", "vendita")
    if modalita == "comodato":
        mod_val = "COMODATO D'USO"
    else:
        totale = (off.get("prezzo_fornitura") or 0) + (off.get("prezzo_care") or 0) + (off.get("canone_lettura") or 0)
        mod_val = f"\u20ac {format_eur(totale)}"

    # Body paragraphs
    replace_runs(doc.paragraphs, "\u00abSTU\u00bb", off["nome_studio"])
    replace_runs(doc.paragraphs, "\u00abVIA\u00bb", via_full)
    replace_runs(doc.paragraphs, "\u00abDAT\u00bb", dat_str)

    # All sections (headers, footers, textboxes) via XML
    for section in doc.sections:
        for rel_type in [section.header, section.footer,
                         section.first_page_header, section.first_page_footer,
                         section.even_page_header, section.even_page_footer]:
            if rel_type and rel_type.is_linked_to_previous is False or rel_type:
                try:
                    replace_xml(rel_type._element, "\u00abNR\u00bb", str(numero))
                    replace_xml(rel_type._element, "\u00abSTU\u00bb", off["nome_studio"])
                    replace_xml(rel_type._element, "\u00abVIA\u00bb", via_full)
                    replace_xml(rel_type._element, "\u00abDAT\u00bb", dat_str)
                except Exception:
                    pass

    # Textboxes in body XML
    replace_xml(doc.element.body, "\u00abPFO\u00bb", pfo)
    replace_xml(doc.element.body, "\u00abPCA\u00bb", pca)
    replace_xml(doc.element.body, "\u00abPCL\u00bb", pcl)
    replace_xml(doc.element.body, "\u00abMOD\u00bb", mod_val)
    replace_xml(doc.element.body, "\u00abNR\u00bb", str(numero))
    replace_xml(doc.element.body, "\u00abSTU\u00bb", off["nome_studio"])
    replace_xml(doc.element.body, "\u00abVIA\u00bb", via_full)
    replace_xml(doc.element.body, "\u00abDAT\u00bb", dat_str)

    doc.save(str(docx_path))

    # PDF conversion
    pdf_error = False
    pdf_path = dest_dir / f"{file_base}.pdf"
    pdf_rel = None
    try:
        from docx2pdf import convert
        convert(str(docx_path), str(pdf_path))
        pdf_rel = f"/output/{anno}/{folder_name}/{file_base}.pdf"
    except Exception as e:
        pdf_error = True
        app.logger.warning(f"PDF conversion failed: {e}")

    docx_rel = f"/output/{anno}/{folder_name}/{docx_name}"

    # Update DB
    conn.execute(
        "UPDATE offerte SET numero=?, path_docx=?, path_pdf=? WHERE id=?",
        (numero, docx_rel, pdf_rel, oid),
    )
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "numero": numero,
        "nome_file": file_base,
        "docx_url": docx_rel,
        "pdf_url": pdf_rel,
        "pdf_error": pdf_error,
    })


# ── Serve output files ───────────────────────────────────────────────

@app.route("/output/<path:filepath>")
def serve_output(filepath):
    full = OUTPUT_DIR / filepath
    if not full.exists():
        abort(404)
    directory = str(full.parent)
    filename = full.name
    return send_from_directory(directory, filename)


# ── API: Clienti ─────────────────────────────────────────────────────

@app.route("/api/clienti", methods=["GET"])
def api_clienti_list():
    q = request.args.get("q", "").strip()
    conn = get_db()
    if q and len(q) >= 2:
        rows = conn.execute(
            "SELECT * FROM clienti WHERE nome_studio LIKE ? OR citta LIKE ? OR referente LIKE ? ORDER BY nome_studio",
            (f"%{q}%", f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM clienti ORDER BY nome_studio").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/clienti", methods=["POST"])
def api_clienti_create():
    data = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO clienti
           (nome_studio, via, cap, citta, email, telefono, referente, note, data_inserimento)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            data.get("nome_studio", ""),
            data.get("via", ""),
            data.get("cap", ""),
            data.get("citta", ""),
            data.get("email", ""),
            data.get("telefono", ""),
            data.get("referente", ""),
            data.get("note", ""),
            now,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM clienti WHERE id=?", (new_id,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/api/clienti/<int:cid>", methods=["GET"])
def api_clienti_detail(cid):
    conn = get_db()
    cliente = conn.execute("SELECT * FROM clienti WHERE id=?", (cid,)).fetchone()
    if not cliente:
        conn.close()
        return jsonify({"error": "Cliente non trovato"}), 404
    offerte = conn.execute(
        "SELECT * FROM offerte WHERE nome_studio=? ORDER BY data_creazione DESC",
        (cliente["nome_studio"],),
    ).fetchall()
    conn.close()
    return jsonify({
        "cliente": dict(cliente),
        "offerte": [dict(o) for o in offerte],
    })


@app.route("/api/clienti/<int:cid>", methods=["PUT"])
def api_clienti_update(cid):
    data = request.json
    conn = get_db()
    allowed = ["nome_studio", "via", "cap", "citta", "email", "telefono", "referente", "note"]
    sets = []
    vals = []
    for k in allowed:
        if k in data:
            sets.append(f"{k}=?")
            vals.append(data[k])
    if sets:
        vals.append(cid)
        conn.execute(f"UPDATE clienti SET {','.join(sets)} WHERE id=?", vals)
        conn.commit()
    row = conn.execute("SELECT * FROM clienti WHERE id=?", (cid,)).fetchone()
    conn.close()
    return jsonify(dict(row))


# ── Startup ──────────────────────────────────────────────────────────

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
