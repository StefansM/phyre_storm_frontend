import os
import sqlite3

import flask
from phyrestorm.phyrestorm import phyrestorm


def app_factory(config):
    app = flask.Flask(__name__, instance_relative_config=True)
    app.config.from_pyfile(config + ".cfg")
    app.register_blueprint(phyrestorm)
    app.teardown_appcontext(db_close)
    return app

def db_conn():
    if flask.g.get("db_conn", None) is None:
        db_file = flask.current_app.config["DATABASE_FILE"]
        flask.current_app.logger.debug("Connecting to db %s.", db_file)
        flask.g.db_conn = sqlite3.connect(db_file)
        flask.g.db_conn.row_factory = sqlite3.Row
    return flask.g.db_conn

def db_close(error):
    if flask.g.get("db_conn", None) is not None:
        flask.current_app.logger.debug("Closing database connection.")
        flask.g.db_conn.close()

app = app_factory(os.environ.get("PHYRESTORM_CONFIG", "development"))
