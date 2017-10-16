import sqlite3
import app
from flask import Blueprint, render_template, current_app, g, jsonify
phyrestorm = Blueprint("phyrestorm", __name__, template_folder="templates")

INITIAL_RESULTS_STATEMENT = """\
SELECT structures.name, tm1, tm2, aln_img
    FROM alignments
    INNER JOIN structures
        ON alignments.structure_id = structures.structure_id
    WHERE job_id=:job_id
    ORDER BY tm1 DESC
    LIMIT :max_alns
"""

ALL_RESULTS_STATEMENT = """\
SELECT structures.name, tm1, tm2
    FROM alignments
    INNER JOIN structures
        ON alignments.structure_id = structures.structure_id
    WHERE job_id=:job_id
    ORDER BY tm1 DESC
"""

# Paging through results after a structure ID
# SELECT * FROM alignments WHERE job_id = "test" AND (tm1 < (SELECT tm1 FROM alignments WHERE job_id = "test" AND structure_id = 2) OR structure_id > 2) ORDER BY tm1 DESC;


@phyrestorm.route("/")
def landing_page():
    return render_template("index.html")

@phyrestorm.route("/results/<job_id>")
def results_page(job_id):
    conn = app.db_conn()
    cursor = conn.cursor()
    hits = cursor.execute(INITIAL_RESULTS_STATEMENT,
                          {"job_id": job_id, "max_alns": 10})
    current_app.logger.debug(hits)
    return render_template("results.html", job_id=job_id, results=hits)

@phyrestorm.route("/results_data/<job_id>")
def results_data(job_id):
    conn = app.db_conn()
    cursor = conn.cursor()
    hits = cursor.execute(ALL_RESULTS_STATEMENT,
                          {"job_id": job_id, "max_alns": 10})
    return jsonify([dict(hit) for hit in hits])
