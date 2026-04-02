"""
Pragma — Gestionale Commerciale Ulteria
Avvia il server in background e apre il browser.
File .pyw = nessuna finestra console visibile.
"""
import subprocess, sys, os, time, webbrowser

APP_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = 0

    subprocess.Popen(
        [sys.executable, os.path.join(APP_DIR, "app.py")],
        cwd=APP_DIR,
        startupinfo=startupinfo,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2)
    webbrowser.open("http://localhost:5000")

if __name__ == "__main__":
    main()
