var request = require('request');
var cheerio = require('cheerio');
var dateutils = require('date-utils');
var Q = require("q");

module.exports = {
	guessBodySelectors : guessBodySelectors,
	guessTOCSelectors : guessTOCSelectors,
	guessSectionSelectors : guessSectionSelectors,
	guess : guess,
	extractBody : extractBody,
	extractTOC : extractTOC,
	extractSections : extractSections,
	extract : extract
};

function extract(config,callback){
	var result = Q.all([
		extractBody(config),
		extractTOC(config),
		extractSections(config)
	]).spread(function(body,toc,sections){
		return {
			body : body,
			toc : toc,
			sections : sections
		};
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function extractBody(config,callback){
	var result = getCheerio(config).then(function($){
		if (config.bodySelectors && config.bodySelectors.length && config.bodySelector === undefined)
			config.bodySelector = config.bodySelectors[0];

		if (config.bodySelector === undefined)
			return undefined;

		return $(config.bodySelector);
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function extractTOC(config,callback){
	var result = getCheerio(config).then(function($){
		if (config.tocSelectors && config.tocSelectors.length && config.tocSelector === undefined)
			config.tocSelector = config.tocSelectors[0];

		if (config.tocSelector === undefined)
			return undefined;

		var toc = $(config.tocSelector);
		var links = toc.find("a");
		
		var levels = links.map(function(){
			var self = this, level = 0;
			
			while (self[0] !== toc[0]){
				level += 1;
				self = self.parent();
			}

			return { el:this, level:level };
		});

		function toTree(a){
			var items = [], thisitem = undefined, i = 0;

			while (i < a.length){
				thisitem = { el:a[i].el, level:a[i].level, children:[] };
				i += 1;

				while (i < a.length && a[i].level > thisitem.level){
					thisitem.children.push(a[i]);
					i += 1;
				}

				thisitem.children = toTree(thisitem.children);

				items.push(thisitem);
			}

			return items;
		}

		return toTree(levels);
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function extractSections(config,callback){
	var result = getCheerio(config).then(function($){
		if (config.sectionSelectors && config.sectionSelectors.length && config.sectionSelector === undefined)
			config.sectionSelector = config.sectionSelectors[0];

		if (config.sectionSelector === undefined && config.bodySelector === undefined)
			return undefined;

		var body = $(config.bodySelector);
		var allheadings = config.sectionSelector.map(function(s){ return s.join(","); }).join(",");
		var headings = body.find(allheadings).map(function(){
			return {
				el : this,
				level : getLevel(this)
			};
		});

		function toTree(a){
			var items = [], thisitem = undefined, i = 0;

			while (i < a.length){
				thisitem = { el:a[i].el, level:a[i].level, children:[] };
				i += 1;

				while (i < a.length && a[i].level > thisitem.level){
					thisitem.children.push(a[i]);
					i += 1;
				}

				thisitem.children = toTree(thisitem.children);

				items.push(thisitem);
			}

			return items;
		}
		
		function getLevel(el){
			for (var i=0; i<config.sectionSelector.length; i++){
				for (var k=0; k<config.sectionSelector[i].length; k++){
					if (el.is(config.sectionSelector[i][k]))
						return i + 1;
				}
			}

			return config.sectionSelector.length + 1;
		}

		return toTree(headings);
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function guess(config,callback){
	var result = Q.all([
		guessBodySelectors(config),
		guessTOCSelectors(config)
	]).spread(function(bodySelectors,tocSelectors){
		if (bodySelectors.length)
			config.bodySelector = bodySelectors[0].key;

		return Q.all([ 
			bodySelectors, 
			tocSelectors, 
			guessSectionSelectors(config) 
		]);
	}).spread(function(bodySelectors,tocSelectors,sectionSelectors){
		return {
			bodySelectors : bodySelectors,
			tocSelectors : tocSelectors,
			sectionSelectors : sectionSelectors
		};
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function guessBodySelectors(config,callback){
    var result = getCheerio(config).then(function($){
    	parents = {};

	    $("h1,h2,h3,p,code,pre").each(function(){
	    	var id = inferSelector(this.parent());
	    	
	    	parents[id] = parents[id] ? parents[id] + 1 : 1;
	    });

	    return countMapAsArray(parents,2);
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function guessTOCSelectors(config,callback){
	var result = getCheerio(config).then(function($){
		var parents = {};

		$("a").each(function(){
			var self = this;

			if (countChildren(self.parent()) === 1)
				self = self.parent();

			var id = inferSelector(self.parent());

			parents[id] = parents[id] ? parents[id] + 1 : 1;
		});

		return countMapAsArray(parents,2);
	});

	if (callback)
		result.nodeify(callback)

	return result;
}

function guessSectionSelectors(config,callback){
	var result = getCheerio(config).then(function($){
		if (config.bodySelector === undefined)
			throw "No bodySelector provided";
		
		var body = $(config.bodySelector);

		var selectors = "h1,h2,h3,h4,h5,h6,h7,h8".split(",").filter(function(s){
			return $(config.bodySelector + " " + s).length > 0;
		}).map(function(s){
			return [ s ];
		});

		return [ selectors ];
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function inferSelector(el){
	if (el.attr("id"))
		return "#" + el.attr("id");
	
	var parent = el.parent(), childindex = 0, selector = "";
	
	if (parent === undefined)
		return "";
	
	// if this element has one class, use that
	if (el.attr("class") && el.attr("class").indexOf(" ") > -1)
		selector = "." + el.attr("class");
	else
		selector = el.length ? el[0].name : el.name;
	
	// if this element is NOT the only child of it's kind, use nth-child
	if (countChildren(parent,selector) > 1){
		parent.find("> " + selector).each(function(i){
			if (this.html() === el.html())
				childindex = i + 1;
		});

		return inferSelector(parent) + " " + selector + ":nth-of-type(" + childindex + ")";
	} 
	else {
		return inferSelector(parent) + " " + selector;
	}

	return "unknown-parent";
}

var responseCache = {};
function getCheerio(config,callback){
	if (config.url && responseCache[config.url]===undefined){
		if (config.html){
			responseCache[config.url] = Q({
				url : config.url,
				html : config.html,
				$ : cheerio.load(config.html),
				timeout : (new Date()).add({ minutes:10 })
			});
		}
		else {
			var promise = Q.defer();

			responseCache[config.url] = promise.promise;

			request(config.url, function (error, response, body) {
				if (error){
					promise.reject(error);
				}
				else if (response.statusCode !== 200){
					promise.reject(response.statusCode);
				}
				else {
					promise.resolve({
						url : config.url,
						html : body,
						$ : cheerio.load(body),
						timeout : (new Date()).add({ minutes:10 })
					});
				}
			});
		}
	}

	// clear timedout caches
	for (var k in responseCache){
		responseCache[k].then(function(cache){
			if (cache.url !== config.url && cache.timeout.isBefore(new Date())){
				delete responseCache[cache.url];
			}
		});
	}

	// return result
	var result = responseCache[config.url].then(function(cache){
		if (cache.$ === undefined){
			delete responseCache[config.url];
			return getCheerio(config);
		}
		else {
			cache.timeout = (new Date()).add({ minutes:10 });
			return cache.$;
		}
	});

	if (callback)
		result.nodeify(callback);

	return result;
}

function countChildren(el,selector){
	var c = 0;

	selector = selector || "";

	if (selector.length)
		return el.find("> " + selector).length;
	else
		return el.find("> *").length;
}

function countMapAsArray(o,min){
	var arr = [];

	for (var k in o){
		if (o[k] >= min)
			arr.push({ key:k, value:o[k] });
	}

	return arr.sort(function(a,b){ return b.value - a.value; }).map(function(v){ return v.key; });
}