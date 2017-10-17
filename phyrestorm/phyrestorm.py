import re
import sqlite3

import app
from flask import Blueprint, render_template, current_app, g, jsonify, request, abort


phyrestorm = Blueprint("phyrestorm", __name__, template_folder="templates")

# Fields that will have path substitution applied
PATH_FIELDS = ('aln_img',)

INITIAL_RESULTS_STATEMENT = """\
SELECT structures.name, structures.structure_id, tm1, tm2, aln_img,
        structures.cluster_index, structures.child_index
    FROM alignments
    INNER JOIN structures
        ON alignments.structure_id = structures.structure_id
    WHERE job_id=:job_id
    ORDER BY tm1 DESC, structures.structure_id ASC
    LIMIT :max_alns
"""

ALL_RESULTS_STATEMENT = """\
SELECT structures.name, structures.structure_id, tm1, tm2
    FROM alignments
    INNER JOIN structures
        ON alignments.structure_id = structures.structure_id
    WHERE job_id=:job_id
    ORDER BY tm1 DESC, structures.structure_id ASC
"""

# Paging through results after a structure ID
PAGE_RESULTS_STATEMENT = """\
SELECT structures.name, structures.structure_id, tm1, tm2, aln_img,
        cluster_index, child_index
    FROM alignments
    INNER JOIN structures
        ON alignments.structure_id = structures.structure_id
    WHERE job_id = :job_id
    AND (
        tm1 < (
            SELECT tm1 FROM alignments
                WHERE job_id = :job_id
                AND alignments.structure_id = :struc_id
                ORDER BY tm1 DESC, structure_id ASC)
        OR alignments.structure_id > :struc_id)
    ORDER BY tm1 DESC, structures.structure_id ASC
    LIMIT :max_alns;
"""

# Retrieve the TM-score of a given structure.
RETRIEVE_TM_SCORE_STATEMENT = """\
    SELECT tm1
    FROM alignments
    WHERE alignments.job_id = :job_id
        AND structure_id = :struc_id;
"""

# Get hits with a TM-score lower than a given TM-score or structure ID greater
# than a given ID. This allows us to first look up the TM-score of a structure
# (RETRIEVE_TM_SCORE_STATEMENT) and then find all all results after that
# according to a sort on tm1 and then structure ID.
RETRIEVE_HITS_AFTER_STATEMENT = """\
    SELECT structures.name, structures.structure_id, tm1, tm2, aln_img,
            structures.cluster_index, structures.child_index
        FROM alignments
        INNER JOIN structures
            ON alignments.structure_id = structures.structure_id
        WHERE job_id=:job_id
            AND (
                (tm1 = :tm1 AND alignments.structure_id > :struc_id)
                OR (tm1 < :tm1))
        ORDER BY tm1 DESC, structures.structure_id ASC
        LIMIT :max_alns
"""

# Maximum number of alignments that can be returned at once
MAX_NUM_ALIGNMENTS = 1000

# Default number of alignments to return
DEFAULT_NUM_ALIGNMENTS = 100


def log_sql(statement, placeholders):
    current_app.logger.debug("Running SQL statement '%s' (%s)",
                             statement, placeholders)

def replace_paths(hits):
    replacements = current_app.config.get("PATH_SUBSTITUTIONS", None)
    if replacements is None:
        return hits

    hits = [dict(hit) for hit in hits]
    for hit in hits:
        for regex, replacement in replacements.items():
            for field in PATH_FIELDS:
                if field not in hit or hit[field] is None:
                    continue
                hit[field] = re.sub(regex, replacement, hit[field])
    return hits


def page_size():
    if "page_size" in request.args:
        num_alns = int(request.args["page_size"])
        if num_alns not in range(0, MAX_NUM_ALIGNMENTS):
            abort(400)
        return num_alns
    return DEFAULT_NUM_ALIGNMENTS

def num_hits(cursor, job_id):
    statement = """\
    SELECT COUNT(structure_id) AS num_alns
    FROM alignments
    WHERE job_id = :job_id"""

    return cursor.execute(statement, {"job_id": job_id}).fetchone()["num_alns"]

@phyrestorm.route("/")
def landing_page():
    return render_template("index.html")

@phyrestorm.route("/results/<job_id>")
def results_page(job_id):
    conn = app.db_conn()
    cursor = conn.cursor()

    placeholders = {"job_id": job_id, "max_alns": 10}
    log_sql(INITIAL_RESULTS_STATEMENT, placeholders)
    hits = cursor.execute(INITIAL_RESULTS_STATEMENT, placeholders)
    hits = replace_paths(hits)

    return render_template(
        "results.html",
        job_id=job_id, results=hits,
        num_alignments=num_hits(cursor, job_id),
        page_size=DEFAULT_NUM_ALIGNMENTS)

@phyrestorm.route("/api/results/<job_id>")
def results_data(job_id):
    conn = app.db_conn()
    after_structure = request.args.get("after", None)

    cursor = conn.cursor()
    if after_structure is None:
        # Get the first few structures
        placeholders = {"job_id": job_id, "max_alns": page_size()}
        hits = cursor.execute(INITIAL_RESULTS_STATEMENT, placeholders)
        hits = replace_paths(hits)
        return jsonify(hits)

    # First, get the tm score of this hit
    placeholders = {"job_id": job_id, "struc_id": after_structure}
    cursor.execute(RETRIEVE_TM_SCORE_STATEMENT, placeholders)
    if not cursor.rowcount:
        abort(400)

    tm_score = cursor.fetchone()["tm1"]
    placeholders = {"job_id": job_id, "tm1": tm_score, "struc_id": after_structure, "max_alns": 10}
    log_sql(RETRIEVE_HITS_AFTER_STATEMENT, placeholders)
    hits = cursor.execute(RETRIEVE_HITS_AFTER_STATEMENT, placeholders)

    hits = replace_paths(hits)
    return jsonify(hits)
