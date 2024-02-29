fetch-deps: public/jquery.js public/bootstrap.css public/bootstrap.js

public/jquery.js:
	curl -o $@ "https://code.jquery.com/jquery-3.7.1.min.js"

public/bootstrap.css:
	curl -o $@ "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"

public/bootstrap.js:
	curl -o $@ "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"

host:
	@echo "Starting PHP's builtin web server. Browse to http://127.0.0.1:8080/index.xhtml to see the interface."
	php -S 127.0.0.1:8080 -t public

.PHONY: host
