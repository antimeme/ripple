
data.html: data.md
	pandoc -s --toc --toc-depth=4 --css=data.css \
	       --from gfm+smart --to html -o $@ $<

clean:
	rm -f data.html

.PHONY: clean
