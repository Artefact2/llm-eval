fetch-deps: public/deps.js public/bootstrap.css

public/deps.js:
	curl "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" "https://code.jquery.com/jquery-3.7.1.min.js" "https://raw.githubusercontent.com/cure53/DOMPurify/main/dist/purify.min.js" "https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js" "https://cdn.jsdelivr.net/npm/marked-xhtml/lib/index.umd.js" > $@.tmp
	mv -f $@.tmp $@

public/bootstrap.css:
	curl -o $@.tmp "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
	mv -f $@.tmp $@

# can be useful when generating new answers on another database.
# import with $(xzcat answers.sql.xz | sqlite3 -bail db.sqlite)
answers.sql.xz: db.sqlite
	(echo "BEGIN;"; printf ".mode insert models\nselect * from models;\n.mode insert prompts\nselect * from prompts;\n.mode insert answers\nselect * from answers;\n" | sqlite3 -init /dev/fd/0 db.sqlite; echo "COMMIT;") | sed 's/^INSERT INTO/INSERT OR IGNORE INTO/g' | xz -0v > $@.tmp
	mv -f $@.tmp $@

host:
	@echo "Starting PHP's builtin web server. Browse to http://127.0.0.1:8080/index.xhtml to see the interface."
	php -S 127.0.0.1:8080 -t public

clean:
	rm -f public/deps.js public/bootstrap.css

.PHONY: host clean
