"""
build_data.py — Tablero de Solicitudes Académicas
UNIMINUTO Sede Tolima - Huila

Lee el libro Solicitudes_Academicas.xlsm (hoja DASHBOARD, exportada de SAP/Banner)
y genera data.json AGREGADO, sin ID de estudiante ni número de secuencia,
listo para publicar en GitHub Pages.

Uso:
    python build_data.py ruta/Solicitudes_Academicas.xlsm [--corte AAAA-MM-DD]

Si no se indica --corte, se toma la fecha de la última solicitud recibida.
"""
import sys, json, re, argparse
from datetime import date
import pandas as pd

EXCLUDE_CU = {"Mocoa", "Florencia", "Puerto Boyacá", "Cajamarca", "Fresno",
              "Líbano", "Mariquita"}
CU_ORDER = ["Ibagué", "Neiva", "Garzón", "Pitalito", "Lérida", "La Dorada", "Planadas"]
CU_FIX = {"Ibague": "Ibagué", "Garzon": "Garzón", "Lerida": "Lérida"}

# Nombres de programa abreviados en SAP -> nombre completo (editable)
PROG_FIX = {
    "Administración De Empresas": "Administración de Empresas",
    "Admin Seguridad Salud Trabajo": "Administración en Seguridad y Salud en el Trabajo",
    "Ingenieria De Sistemas": "Ingeniería de Sistemas",
    "Administracion Financiera": "Administración Financiera",
    "Li Educacion Infantil": "Licenciatura en Educación Infantil",
    "Li En Educacion Infantil": "Licenciatura en Educación Infantil",
    "Lc Ed Fisica Recrea Deportes": "Licenciatura en Educación Física, Recreación y Deportes",
    "Psicologia": "Psicología",
    "Esp En Gerencia De Proyectos": "Especialización en Gerencia de Proyectos",
    "Ms Gerencia Innovación Proyect": "Maestría en Gerencia de la Innovación y Proyectos",
    "Adm Emp Turisticas Y Hoteleras": "Administración de Empresas Turísticas y Hoteleras",
    "Es Gerencia Financiera": "Especialización en Gerencia Financiera",
    "Es Gcia Ries Lbles Salud Trab": "Especialización en Gerencia de Riesgos Laborales, Seguridad y Salud en el Trabajo",
}
TIPO_FIX = {
    "Reconocimiento Aprendizaje Previos RAP": "Reconocimiento de Aprendizajes Previos (RAP)",
    "Revisión de pruebas y calificaciones (segunda revisión)": "Segunda revisión de pruebas y calificaciones",
}


def clean(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def nivel(prog_sap):
    p = prog_sap.lower()
    if p.startswith(("ms ", "maestr")): return "Maestría"
    if p.startswith(("esp ", "es ", "especializ")): return "Especialización"
    return "Pregrado"


def plazos(src):
    """Tiempo de respuesta (días hábiles) por tipo de solicitud, hoja Tiempos."""
    t = pd.read_excel(src, sheet_name="Tiempos", usecols=[0, 1, 3])
    t.columns = ["sol", "dias", "tipo"]
    t = t.dropna(subset=["sol"])
    out = {}
    for _, r in t.iterrows():
        k = TIPO_FIX.get(clean(r.sol), clean(r.sol))
        if pd.notna(r.dias):
            out[k] = {"dias": int(r.dias), "gestion": clean(r.tipo)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--corte", help="Fecha de corte AAAA-MM-DD")
    a = ap.parse_args()

    df = pd.read_excel(a.src, sheet_name="DASHBOARD")
    df.columns = [clean(c) for c in df.columns]
    df = df.dropna(subset=["NOMBRE_SEDE", "Fecha de Recepción"])

    cu = df["NOMBRE_SEDE"].map(clean).str.replace(r"^Cu\s+", "", regex=True).replace(CU_FIX)
    df = df[~cu.isin(EXCLUDE_CU)].copy()
    cu = cu[df.index]
    prog_sap = df["NOMBRE_PROGRAMA"].map(clean)

    rec = pd.to_datetime(df["Fecha de Recepción"]).dt.normalize()
    ven = pd.to_datetime(df["Fecha de Vencimiento"]).dt.normalize()
    corte = a.corte or rec.max().strftime("%Y-%m-%d")

    out = pd.DataFrame({
        "cu": cu,
        "prog": prog_sap.replace(PROG_FIX),
        "niv": prog_sap.map(nivel),
        "tipo": df["DESCRIPCION_SOLICITUD"].map(clean).replace(TIPO_FIX),
        "est": df["ESTADO"].map(clean),
        "rec": rec.dt.strftime("%Y-%m-%d"),
        "ven": ven.dt.strftime("%Y-%m-%d"),
    })
    unknown = set(out["cu"]) - set(CU_ORDER)
    if unknown:
        raise SystemExit(f"Centros Universitarios sin clasificar: {unknown}")

    dims = list(out.columns)
    agg = out.groupby(dims).size().reset_index(name="n")

    dicts = {}
    for c in dims:
        vals = sorted(agg[c].unique(), key=str)
        if c == "cu":
            vals = [v for v in CU_ORDER if v in set(vals)]
        elif c in ("prog", "tipo"):
            vals = list(agg.groupby(c)["n"].sum().sort_values(ascending=False).index)
        dicts[c] = [str(v) for v in vals]
    idx = {c: {v: i for i, v in enumerate(dicts[c])} for c in dims}
    rows = [[idx[c][str(r[c])] for c in dims] + [int(r.n)] for _, r in agg.iterrows()]

    data = {
        "meta": {"corte": corte, "registros": int(agg.n.sum()),
                 "generado": date.today().isoformat(),
                 "fuente": "Solicitudes Académicas (SAP/Banner) — hoja DASHBOARD"},
        "plazos": {k: v for k, v in plazos(a.src).items() if k in set(dicts["tipo"])},
        "cols": dims + ["n"],
        "dicts": dicts,
        "rows": rows,
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"data.json: {data['meta']['registros']} solicitudes, {len(rows)} filas agregadas, corte {corte}")


if __name__ == "__main__":
    main()
