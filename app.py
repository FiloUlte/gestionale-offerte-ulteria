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
        CREATE TABLE IF NOT EXISTS agenti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            cognome TEXT,
            email TEXT,
            telefono TEXT,
            colore TEXT DEFAULT '#009FE3',
            note TEXT,
            data_inserimento DATETIME
        );
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
            note TEXT,
            agente_id INTEGER REFERENCES agenti(id)
        );
        CREATE TABLE IF NOT EXISTS clienti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_studio TEXT UNIQUE,
            via TEXT,
            cap TEXT,
            citta TEXT,
            email TEXT,
            telefono TEXT,
            referente TEXT,
            note TEXT,
            data_inserimento DATETIME
        );
        CREATE TABLE IF NOT EXISTS attivita (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agente_id INTEGER NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'todo',
            titolo TEXT NOT NULL,
            descrizione TEXT,
            data_scadenza DATETIME,
            priorita TEXT DEFAULT 'media',
            stato TEXT DEFAULT 'aperta',
            cliente_id INTEGER,
            offerta_id INTEGER,
            completato_il DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agente_id) REFERENCES agenti(id),
            FOREIGN KEY (cliente_id) REFERENCES clienti(id),
            FOREIGN KEY (offerta_id) REFERENCES offerte(id)
        );
        CREATE TABLE IF NOT EXISTS condomini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            indirizzo TEXT,
            comune TEXT,
            provincia TEXT,
            stato_pipeline TEXT DEFAULT 'prospect',
            agente_id INTEGER,
            data_assemblea DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS note_clienti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            testo TEXT NOT NULL,
            autore TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Migrations for existing DBs
    # -- ROLLBACK: ALTER TABLE offerte DROP COLUMN agente_id
    # -- ROLLBACK: ALTER TABLE agenti DROP COLUMN colore
    # -- ROLLBACK: ALTER TABLE offerte DROP COLUMN motivo_perdita
    # -- ROLLBACK: ALTER TABLE offerte DROP COLUMN note_perdita
    # -- ROLLBACK: ALTER TABLE offerte DROP COLUMN importo
    # -- ROLLBACK: ALTER TABLE offerte DROP COLUMN condominio_id
    # -- ROLLBACK: ALTER TABLE clienti DROP COLUMN tipo_cliente
    for stmt in [
        "ALTER TABLE offerte ADD COLUMN agente_id INTEGER REFERENCES agenti(id)",
        "ALTER TABLE agenti ADD COLUMN colore TEXT DEFAULT '#009FE3'",
        "ALTER TABLE offerte ADD COLUMN motivo_perdita TEXT",
        "ALTER TABLE offerte ADD COLUMN note_perdita TEXT",
        "ALTER TABLE offerte ADD COLUMN importo REAL",
        "ALTER TABLE offerte ADD COLUMN condominio_id INTEGER",
        "ALTER TABLE clienti ADD COLUMN tipo_cliente TEXT DEFAULT 'lead'",
    ]:
        try:
            conn.execute(stmt)
        except Exception:
            pass
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


def fix_stu_via_paragraph(doc, nome_studio, via_studio):
    """Rewrite STU/VIA paragraph: remove all tab-based layout, create two
    clean right-aligned lines using w:br (line break) in Word XML."""
    from lxml import etree
    from copy import deepcopy

    for p in doc.paragraphs:
        has_stu = any(nome_studio in r.text for r in p.runs)
        has_via = any(via_studio in r.text for r in p.runs)
        if not (has_stu and has_via):
            continue

        # Change paragraph alignment from JUSTIFY to RIGHT
        pPr = p._element.find(qn("w:pPr"))
        if pPr is not None:
            jc = pPr.find(qn("w:jc"))
            if jc is not None:
                jc.set(qn("w:val"), "right")
            else:
                jc = etree.SubElement(pPr, qn("w:jc"))
                jc.set(qn("w:val"), "right")
            # Remove first-line indent which shifts text
            ind = pPr.find(qn("w:ind"))
            if ind is not None:
                for attr in ["firstLine", "left", "hanging"]:
                    k = qn("w:" + attr)
                    if k in ind.attrib:
                        del ind.attrib[k]

        # Collect run info: find STU run and VIA run
        stu_run_el = None
        via_run_el = None
        tab_runs = []
        for r in p._element.findall(qn("w:r")):
            texts = r.findall(qn("w:t"))
            tabs = r.findall(qn("w:tab"))
            text_content = "".join(t.text or "" for t in texts)
            if nome_studio in text_content:
                stu_run_el = r
            elif via_studio in text_content:
                via_run_el = r
            elif tabs and not text_content.strip():
                tab_runs.append(r)

        if stu_run_el is None or via_run_el is None:
            break

        # Remove ALL tab-only runs from paragraph
        for tr in tab_runs:
            p._element.remove(tr)

        # Insert a line break run between STU and VIA
        # Create a run with <w:br/> + tabs for indentation
        br_run = deepcopy(stu_run_el)
        # Clear text and tab elements from the copy
        for child in list(br_run):
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if tag in ("t", "tab"):
                br_run.remove(child)
        # Add line break element
        rPr = br_run.find(qn("w:rPr"))
        insert_pos = list(br_run).index(rPr) + 1 if rPr is not None else 0
        br_el = etree.Element(qn("w:br"))
        br_run.insert(insert_pos, br_el)

        # Insert br_run right before via_run_el
        p._element.insert(list(p._element).index(via_run_el), br_run)

        # Copy formatting from STU run to VIA run (but keep non-bold)
        via_rPr = via_run_el.find(qn("w:rPr"))
        if via_rPr is None:
            via_rPr = etree.SubElement(via_run_el, qn("w:rPr"))
            via_run_el.insert(0, via_rPr)

        break


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
    sql = "SELECT * FROM offerte WHERE 1=1"
    params = []
    if request.args.get("agente_id"):
        sql += " AND agente_id=?"
        params.append(int(request.args["agente_id"]))
    if request.args.get("stato"):
        stati = request.args["stato"].split(",")
        sql += " AND stato IN (" + ",".join("?" * len(stati)) + ")"
        params.extend(stati)
    if request.args.get("template"):
        sql += " AND template=?"
        params.append(request.args["template"])
    if request.args.get("q"):
        q = f"%{request.args['q']}%"
        sql += " AND (nome_studio LIKE ? OR nome_condominio LIKE ? OR citta LIKE ? OR CAST(numero AS TEXT) LIKE ?)"
        params.extend([q, q, q, q])
    if request.args.get("dal"):
        sql += " AND data_creazione>=?"
        params.append(request.args["dal"])
    if request.args.get("al"):
        sql += " AND data_creazione<=?"
        params.append(request.args["al"] + " 23:59:59")
    sql += " ORDER BY id DESC"
    rows = conn.execute(sql, params).fetchall()
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
        "note", "path_docx", "path_pdf", "numero", "agente_id",
        "motivo_perdita", "note_perdita", "importo",
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


@app.route("/api/offerte/<int:oid>/duplica", methods=["POST"])
def api_offerte_duplica(oid):
    conn = get_db()
    row = conn.execute("SELECT * FROM offerte WHERE id=?", (oid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Non trovata"}), 404
    orig = dict(row)

    cfg = read_config()
    numero = cfg["prossimo_numero"]
    cfg["prossimo_numero"] = numero + 1
    write_config(cfg)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur = conn.execute(
        """INSERT INTO offerte
           (numero, nome_studio, nome_condominio, via, cap, citta,
            riferimento, template, prezzo_fornitura, prezzo_care,
            canone_lettura, modalita, importo, stato, email_studio,
            data_creazione, note, agente_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            numero, orig["nome_studio"], orig["nome_condominio"],
            orig["via"], orig["cap"], orig["citta"],
            orig["riferimento"], orig["template"],
            orig["prezzo_fornitura"], orig["prezzo_care"],
            orig["canone_lettura"], orig["modalita"], orig.get("importo"),
            "in_attesa_assemblea", orig["email_studio"],
            now, orig["note"], orig["agente_id"],
        ),
    )
    conn.commit()
    new_row = conn.execute("SELECT * FROM offerte WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(new_row)), 201


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

    dat_str = datetime.now().strftime("%d/%m/%Y")

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
    replace_runs(doc.paragraphs, "\u00abVIA\u00bb", via_studio)
    replace_runs(doc.paragraphs, "\u00abDAT\u00bb", dat_str)

    # Fix STU/VIA alignment: put VIA on new line under STU
    fix_stu_via_paragraph(doc, off["nome_studio"], via_studio)

    # All sections (headers, footers, textboxes) via XML
    for section in doc.sections:
        for rel_type in [section.header, section.footer,
                         section.first_page_header, section.first_page_footer,
                         section.even_page_header, section.even_page_footer]:
            if rel_type and rel_type.is_linked_to_previous is False or rel_type:
                try:
                    replace_xml(rel_type._element, "\u00abNR\u00bb", str(numero))
                    replace_xml(rel_type._element, "\u00abSTU\u00bb", off["nome_studio"])
                    replace_xml(rel_type._element, "\u00abVIA\u00bb", via_studio)
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
    replace_xml(doc.element.body, "\u00abVIA\u00bb", via_studio)
    replace_xml(doc.element.body, "\u00abDAT\u00bb", dat_str)

    doc.save(str(docx_path))

    # PDF conversion via Word COM
    pdf_error = False
    pdf_path = dest_dir / f"{file_base}.pdf"
    pdf_rel = None
    try:
        import pythoncom
        pythoncom.CoInitialize()
        try:
            import win32com.client
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            word.DisplayAlerts = False
            doc_com = word.Documents.Open(str(docx_path.resolve()))
            doc_com.SaveAs2(str(pdf_path.resolve()), FileFormat=17)  # 17 = PDF
            doc_com.Close(False)
            word.Quit()
            pdf_rel = f"/output/{anno}/{folder_name}/{file_base}.pdf"
        finally:
            pythoncom.CoUninitialize()
    except Exception as e:
        pdf_error = True
        app.logger.warning(f"PDF conversion failed: {e}")
        # Fallback: try docx2pdf
        try:
            from docx2pdf import convert
            convert(str(docx_path), str(pdf_path))
            pdf_rel = f"/output/{anno}/{folder_name}/{file_base}.pdf"
            pdf_error = False
        except Exception as e2:
            app.logger.warning(f"docx2pdf fallback also failed: {e2}")

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
    nome = data.get("nome_studio", "").strip()
    if not nome:
        return jsonify({"error": "nome_studio obbligatorio"}), 400

    conn = get_db()
    # Check if client already exists (case-insensitive)
    existing = conn.execute(
        "SELECT * FROM clienti WHERE LOWER(nome_studio) = LOWER(?)", (nome,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify(dict(existing)), 200  # Return existing, don't duplicate

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur = conn.execute(
        """INSERT INTO clienti
           (nome_studio, via, cap, citta, email, telefono, referente, note, data_inserimento)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            nome,
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
    allowed = ["nome_studio", "via", "cap", "citta", "email", "telefono", "referente", "note", "tipo_cliente"]
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


# ── Scheda Cliente (pagina dedicata) ─────────────────────────────────

@app.route("/clienti/<int:cid>")
def cliente_page(cid):
    return render_template("cliente.html", cliente_id=cid)


@app.route("/api/clienti/<int:cid>/note", methods=["POST"])
def api_clienti_add_note(cid):
    data = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO note_clienti (cliente_id, testo, autore, created_at) VALUES (?,?,?,?)",
        (cid, data.get("testo", ""), data.get("autore", ""), now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM note_clienti WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify({"ok": True, "data": dict(row)}), 201


@app.route("/api/note/<int:nid>", methods=["DELETE"])
def api_note_delete(nid):
    conn = get_db()
    conn.execute("DELETE FROM note_clienti WHERE id=?", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/clienti/<int:cid>/full", methods=["GET"])
def api_clienti_full(cid):
    """Full client detail with offerte, condomini, note."""
    conn = get_db()
    cliente = conn.execute("SELECT * FROM clienti WHERE id=?", (cid,)).fetchone()
    if not cliente:
        conn.close()
        return jsonify({"error": "Cliente non trovato"}), 404
    offerte = conn.execute(
        "SELECT o.*, a.nome as agente_nome, a.cognome as agente_cognome, a.colore as agente_colore "
        "FROM offerte o LEFT JOIN agenti a ON o.agente_id = a.id "
        "WHERE LOWER(o.nome_studio) = LOWER(?) ORDER BY o.data_creazione DESC",
        (cliente["nome_studio"],),
    ).fetchall()
    condomini = conn.execute(
        "SELECT * FROM condomini WHERE cliente_id=? ORDER BY nome", (cid,)
    ).fetchall()
    note = conn.execute(
        "SELECT * FROM note_clienti WHERE cliente_id=? ORDER BY created_at DESC", (cid,)
    ).fetchall()
    conn.close()
    return jsonify({
        "cliente": dict(cliente),
        "offerte": [dict(o) for o in offerte],
        "condomini": [dict(c) for c in condomini],
        "note": [dict(n) for n in note],
    })


# ── API: Agenti ──────────────────────────────────────────────────────

@app.route("/api/agenti", methods=["GET"])
def api_agenti_list():
    conn = get_db()
    rows = conn.execute("SELECT * FROM agenti ORDER BY cognome, nome").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/agenti", methods=["POST"])
def api_agenti_create():
    data = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO agenti (nome, cognome, email, telefono, colore, note, data_inserimento)
           VALUES (?,?,?,?,?,?,?)""",
        (
            data.get("nome", ""),
            data.get("cognome", ""),
            data.get("email", ""),
            data.get("telefono", ""),
            data.get("colore", "#009FE3"),
            data.get("note", ""),
            now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM agenti WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/api/agenti/<int:aid>", methods=["GET"])
def api_agenti_detail(aid):
    conn = get_db()
    agente = conn.execute("SELECT * FROM agenti WHERE id=?", (aid,)).fetchone()
    if not agente:
        conn.close()
        return jsonify({"error": "Agente non trovato"}), 404
    offerte = conn.execute(
        "SELECT * FROM offerte WHERE agente_id=? ORDER BY data_creazione DESC",
        (aid,),
    ).fetchall()
    conn.close()
    return jsonify({
        "agente": dict(agente),
        "offerte": [dict(o) for o in offerte],
    })


@app.route("/api/agenti/<int:aid>", methods=["PUT"])
def api_agenti_update(aid):
    data = request.json
    conn = get_db()
    allowed = ["nome", "cognome", "email", "telefono", "colore", "note"]
    sets = []
    vals = []
    for k in allowed:
        if k in data:
            sets.append(f"{k}=?")
            vals.append(data[k])
    if sets:
        vals.append(aid)
        conn.execute(f"UPDATE agenti SET {','.join(sets)} WHERE id=?", vals)
        conn.commit()
    row = conn.execute("SELECT * FROM agenti WHERE id=?", (aid,)).fetchone()
    conn.close()
    return jsonify(dict(row))


# ── API: Agenti Dashboard ────────────────────────────────────────────

@app.route("/agenti/<int:aid>")
def agente_page(aid):
    return render_template("agente.html", agente_id=aid)


@app.route("/api/agenti/<int:aid>/dashboard", methods=["GET"])
def api_agente_dashboard(aid):
    conn = get_db()
    agente = conn.execute("SELECT * FROM agenti WHERE id=?", (aid,)).fetchone()
    if not agente:
        conn.close()
        return jsonify({"error": "Agente non trovato"}), 404

    offerte = conn.execute(
        "SELECT * FROM offerte WHERE agente_id=? ORDER BY data_creazione DESC", (aid,)
    ).fetchall()

    attivita = conn.execute(
        "SELECT a.*, c.nome_studio as cliente_nome FROM attivita a "
        "LEFT JOIN clienti c ON a.cliente_id = c.id "
        "WHERE a.agente_id=? ORDER BY a.data_scadenza ASC", (aid,)
    ).fetchall()

    # Clienti affidati: clienti con almeno un'offerta di questo agente
    clienti_rows = conn.execute(
        "SELECT c.*, COUNT(o.id) as num_offerte, MAX(o.data_creazione) as ultimo_contatto "
        "FROM clienti c JOIN offerte o ON LOWER(c.nome_studio) = LOWER(o.nome_studio) "
        "WHERE o.agente_id=? GROUP BY c.id ORDER BY c.nome_studio", (aid,)
    ).fetchall()

    # Stats mensili (ultimi 6 mesi)
    stats = conn.execute(
        "SELECT strftime('%Y-%m', data_creazione) as mese, "
        "COUNT(*) as inviate, "
        "SUM(CASE WHEN stato='preso_lavoro' THEN 1 ELSE 0 END) as prese, "
        "SUM(CASE WHEN stato='perso' THEN 1 ELSE 0 END) as perse "
        "FROM offerte WHERE agente_id=? AND data_creazione IS NOT NULL "
        "GROUP BY mese ORDER BY mese DESC LIMIT 6", (aid,)
    ).fetchall()

    conn.close()
    return jsonify({
        "agente": dict(agente),
        "offerte": [dict(o) for o in offerte],
        "attivita": [dict(a) for a in attivita],
        "clienti": [dict(c) for c in clienti_rows],
        "stats": [dict(s) for s in stats],
    })


# ── API: Attivita ────────────────────────────────────────────────────

@app.route("/api/attivita", methods=["POST"])
def api_attivita_create():
    data = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO attivita (agente_id, tipo, titolo, descrizione,
           data_scadenza, priorita, stato, cliente_id, offerta_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            data.get("agente_id"),
            data.get("tipo", "todo"),
            data.get("titolo", ""),
            data.get("descrizione", ""),
            data.get("data_scadenza"),
            data.get("priorita", "media"),
            "aperta",
            data.get("cliente_id"),
            data.get("offerta_id"),
            now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM attivita WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/api/attivita/<int:tid>", methods=["PATCH"])
def api_attivita_update(tid):
    data = request.json
    conn = get_db()
    allowed = ["tipo", "titolo", "descrizione", "data_scadenza", "priorita", "cliente_id", "offerta_id"]
    sets = []
    vals = []
    for k in allowed:
        if k in data:
            sets.append(f"{k}=?")
            vals.append(data[k])
    if sets:
        vals.append(tid)
        conn.execute(f"UPDATE attivita SET {','.join(sets)} WHERE id=?", vals)
        conn.commit()
    row = conn.execute("SELECT * FROM attivita WHERE id=?", (tid,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.route("/api/attivita/<int:tid>/completa", methods=["PATCH"])
def api_attivita_completa(tid):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute(
        "UPDATE attivita SET stato='completata', completato_il=? WHERE id=?",
        (now, tid),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/attivita/<int:tid>", methods=["DELETE"])
def api_attivita_delete(tid):
    conn = get_db()
    conn.execute("DELETE FROM attivita WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/clienti/search", methods=["GET"])
def api_clienti_search():
    q = request.args.get("q", "").strip()
    conn = get_db()
    if q and len(q) >= 1:
        rows = conn.execute(
            "SELECT id, nome_studio, citta FROM clienti WHERE nome_studio LIKE ? ORDER BY nome_studio LIMIT 10",
            (f"%{q}%",),
        ).fetchall()
    else:
        rows = conn.execute("SELECT id, nome_studio, citta FROM clienti ORDER BY nome_studio LIMIT 10").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/offerte/by-cliente/<int:cid>", methods=["GET"])
def api_offerte_by_cliente(cid):
    conn = get_db()
    cliente = conn.execute("SELECT nome_studio FROM clienti WHERE id=?", (cid,)).fetchone()
    if not cliente:
        conn.close()
        return jsonify([])
    rows = conn.execute(
        "SELECT id, numero, nome_condominio, riferimento FROM offerte WHERE LOWER(nome_studio)=LOWER(?) ORDER BY data_creazione DESC",
        (cliente["nome_studio"],),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/agenti/<int:aid>/badges", methods=["GET"])
def api_agente_badges(aid):
    conn = get_db()
    offerte_aperte = conn.execute(
        "SELECT COUNT(*) FROM offerte WHERE agente_id=? AND stato IN ('richiamato','in_attesa_assemblea','rimandato')",
        (aid,),
    ).fetchone()[0]
    attivita_urgenti = conn.execute(
        "SELECT COUNT(*) FROM attivita WHERE agente_id=? AND stato='aperta' AND data_scadenza <= date('now')",
        (aid,),
    ).fetchone()[0]
    conn.close()
    return jsonify({"offerte_aperte": offerte_aperte, "attivita_urgenti": attivita_urgenti})


@app.route("/api/attivita/scadute-count", methods=["GET"])
def api_attivita_scadute_count():
    conn = get_db()
    count = conn.execute(
        "SELECT COUNT(*) FROM attivita WHERE stato='aperta' AND date(data_scadenza) <= date('now')"
    ).fetchone()[0]
    conn.close()
    return jsonify({"count": count})


@app.route("/api/agenti/<int:aid>/stats", methods=["GET"])
def api_agente_stats(aid):
    conn = get_db()
    offs = conn.execute("SELECT * FROM offerte WHERE agente_id=?", (aid,)).fetchall()
    tot = len(offs)
    prese = sum(1 for o in offs if o["stato"] == "preso_lavoro")
    perse = sum(1 for o in offs if o["stato"] == "perso")
    aperte = sum(1 for o in offs if o["stato"] in ("richiamato", "in_attesa_assemblea", "rimandato"))
    val_preso = sum((o["prezzo_fornitura"] or 0) + (o["prezzo_care"] or 0) + (o["canone_lettura"] or 0) for o in offs if o["stato"] == "preso_lavoro")
    val_pipeline = sum((o["prezzo_fornitura"] or 0) + (o["prezzo_care"] or 0) + (o["canone_lettura"] or 0) for o in offs if o["stato"] in ("richiamato", "in_attesa_assemblea"))
    tasso = round(prese / tot * 100, 1) if tot > 0 else 0
    att_aperte = conn.execute("SELECT COUNT(*) FROM attivita WHERE agente_id=? AND stato='aperta'", (aid,)).fetchone()[0]
    att_scadute = conn.execute("SELECT COUNT(*) FROM attivita WHERE agente_id=? AND stato='aperta' AND data_scadenza <= date('now')", (aid,)).fetchone()[0]
    conn.close()
    return jsonify({
        "ok": True,
        "data": {
            "totale_offerte": tot, "prese": prese, "perse": perse, "aperte": aperte,
            "valore_preso": val_preso, "valore_pipeline": val_pipeline, "tasso_conversione": tasso,
            "attivita_aperte": att_aperte, "attivita_scadute": att_scadute,
        }
    })


# ── Startup ──────────────────────────────────────────────────────────

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)
