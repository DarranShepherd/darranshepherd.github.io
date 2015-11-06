(function() {
	'use script';
	
	// See http://blog.parkermoore.de/2014/08/01/header-anchor-links-in-vanilla-javascript-for-github-pages-and-jekyll/
	var anchorForId = function (id) {
		var anchor = document.createElement("a");
		anchor.name      = "#" + id;
		return anchor;
	};
	
	var linkifyAnchors = function (level, containingElement) {
		var headers = containingElement.getElementsByTagName("h" + level);
		for (var h = 0; h < headers.length; h++) {
			var header = headers[h];
		
			if (typeof header.id !== "undefined" && header.id !== "") {
				header.insertBefore(anchorForId(header.id), header.firstChild);
			}
		}
	};
	
	document.onreadystatechange = function () {
		if (this.readyState === "complete") {
			var contentBlock = document.getElementsByTagName("article")[0];
			if (!contentBlock) {
				return;
			}
			for (var level = 1; level <= 6; level++) {
				linkifyAnchors(level, contentBlock);
			}
		}
	};
}());