extractdoc
==========

For extracting structured information from an HTML document.

Because this utility is was created for extracting highly structured information from online reference docs, and because the way they present that structure is so variable, extraction has two stages:

# Identifying document elements

The extraction functions take selectors to find the relevant parts of the document, and this module has functions for making educated guesses about them.

## guess(config)

`config` must always contain a `url`, but can optionally also contain an `html` string or a `$` [Cheerio] object.

This is a shortcut function for running `guessBodySelectors`, `guessTOCSelectors`, and `guessSectionSelectors`. Returns an object in the form `{ bodySelectors, tocSelectors, sectionSelectors }`.

## guessBodySelectors(config)

`config` - as with `guess`

Looks for potential "main body" elements. Returns an array of likely Cheerio selectors, in order of likelyhood.

Example output:

	[ "#maindoc", "#content", ".sidebar" ]

## guessTOCSelectors(config)

`config` - as with `guess`

Looks for potential "index" elements. This is primarily for use when the documentation is spread over several pages. You wouldn't use it for single page reference docs. Returns an array of likely Cheerio selectors, in order of likelyhood.

Example output:
	
	[ "#toc", "#toc ul:nth-of-type(0)" ]

## guessSectionSelectors(config)

`config` - as with `guess`

Looks for potential reference hierarchy elements. Where the other guessing functions returns arrays of single selectors, this function returns arrays of selector arrays, where each element is a different level in the hierarchy.

Example:

	[
		[ "h1", "h2", "h3" ]
	]

## extract(config)

`config` has the following optional values:

* *bodySelector*: Cheerio selector for the document body
* *tocSelector*: Cheerio selector for the TOC element
* *sectionSelector*: array of Cheerio selectors for hierarchy titles elements
* You can also pass in the values as returned by `guess`, and extract will just use the most highly suggested selectors

*NOTE*: if you pass in sectionSelector, you must also pass in bodySelector.

Example output:

	{
		body : [cheerio object],
		toc : [{ 
			el : [cheerio object],
			children : [toc array]
		}],
		sections : [{
			el : [cheerio object],
			children : [sections array]
		}]
	}

You can use `extractBody`, `extractTOC`, and `extractSections` if you only need specific parts.

[cheerio]: https://github.com/MatthewMueller/cheerio