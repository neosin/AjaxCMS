/////////////////////////////////  CONFIGURATION   ///////////////////////////////
		
var load_transition = "slide";

$.ajaxSetup({ cache: false });

//////////////////////////////////////////////////////////////////////////////////

var menus = [];
var pages = [];
var layouts = [];
var blogs = [];
var images = [];
var themes = [];

var menu_count = 0; // Keep track of recursive asyncronous directory list.
var pages_count = 0;
var images_count = 0;
var in_transition = false;

var base_url = window.location.href.replace(/\?.*/,'');
var params = window.location.href.replace(/.*\?/,'').split('&');
var current_page;
var just_pages;
var menu_pages;
var data;


// Resize <main> to fit children;
function scaleMain(selector) {
    var objHeight = $(selector).height();
    $('#main').height(objHeight);
}

// return url parameter value
function param(key) {
	for (i=0; i<params.length; i++) {
		x = params[i].split("=");
		if (x[0] == key) {return x[1]}
	}
}

// Pages return just the html files (not directories)
function findPages() {
	return $.grep(pages, function(n,i){
		if (/\/layout\.html$/.test(n)) {layouts.push(n)}
		
		return /[\.html|\.md]$/.test(n) && !/\/layout\.html$/.test(n);
	});
}

function findMenus(){
	return $.grep(pages, function(n,i){
		return /\/menus\/.+/.test(n) && !/\/layout\.html$/.test(n);
	});
}

// Return Index of specified menu
function menuIndex(m) {
	return menus.indexOf(m);
}
function mpIndex(m) {
	return menu_pages.indexOf(m);
}


// Parse apache directory listing data... add to pages
function load_pages(url) {
	url = url.replace(/\/$/,''); // Remove trailing slash from starting point url
	pages_count++;
	$.get( url, function( data ) {
		var f;
		var rows = $(data).find('tr');
		for (i = 3; i < rows.length - 1; i++) {
			f = url + '/' + $(rows[i]).find('td a')[0].innerHTML;
			pages.push(f);
			
			// Call directory recursively.
			if (/\/$/.test(f)) { // if file list ends in / then it is a dir
				load_pages(f);
			}
		}
	}).then(function(){
		pages_count--;
		if (pages_count === 0) {
			
			// Stuff to run after menu list is loaded.
			menus = findMenus().sort();
			makemenu();
			just_pages = findPages().sort();
			menu_pages = $.grep(just_pages, function(n,i){return /\/menus\/.+/.test(n)});

			// Load the page in the params if specified, first menu page otherwise.
			p = param('page');
			if (p) {
				loadPage('./'+p, true);
				current_page = p;
			} else {
				current_page = menu_pages[0];
				loadPage(current_page, true); // Load the first page (home page) on init.
			}
		}
	});
}


// Parse apache directory listing data... add to images
function load_images(url) {
	url = url.replace(/\/$/,''); // Remove trailing slash from starting point url
	images_count++;
	$.get( url, function( data ) {
		var f;
		var rows = $(data).find('tr');
		for (i = 3; i < rows.length - 1; i++) {
			f = $(rows[i]).find('td a')[0].innerHTML;
			if (f == 'icon/') { continue; }
			if (f == 'thumb/') { continue; }
			if (f == 'small/') { continue; }
			if (f == 'medium/') { continue; }
			if (f == 'large/') { continue; }
			images.push(url+'/'+f);
			// Call directory recursively.
			if (/\/$/.test(f)) { // if file list ends in / then it is a dir
				load_images(url+'/'+f);
			}
		}
	}).then(function(){
		images_count--;
		if (images_count === 0) {
			// Stuff to run after page list is loaded.	
		}
	});
}

// Parse apache directory listing data... add to themes
function load_themes(url) {
	url = url.replace(/\/$/,''); // Remove trailing slash from starting point url
	images_count++;
	$.get( url, function( data ) {
		var f;
		var rows = $(data).find('tr');
		for (i = 3; i < rows.length - 1; i++) {
			f = $(rows[i]).find('td a')[0].innerHTML;
			// Save only the first level of directories.
			if (/\/$/.test(f)) { // if file list ends in / then it is a dir
				themes.push(f.replace(/\/$/,''));
			}
		}
	}).then(function(){
		var menutext = 
		
			"<ul class=\"nav navbar-nav navbar-right\">" +
				"<li class=\"dropdown\">" + 
					"<a class=\"dropdown-toggle\" data-toggle=\"dropdown\" href=\"#\">Themes" +
	        		"<span class=\"caret\"></span></a>" + 
					"<ul class=\"dropdown-menu\">"
	    
	    for (var ii=0; ii<themes.length; ii++) {
	    	menutext += "<li><a href=\"?theme="+themes[ii]+"\">"+themes[ii]+"</a></li>"
	    }    		
	    
	    menutext += "</ul></li></ul>"
    		
    	$('#menu').after(menutext);
	});
}

// Return the url of the first partial-match image.
function imageMatch(s) {
	for (i=0; i<images.length; i++) {
		var re = new RegExp(s,"gi");
		if (re.test(images[i])){return images[i]} 
	}
}

// Return the url of the first partial-match page.
function pageMatch(s) {
	var best_match = "";
	var return_url = "";
	for (i=0; i<just_pages.length; i++) {
		
		var re = new RegExp(s,"gi");
		
		// Best match is shortest filename without directories stripped of headers and footers. 
		if (re.test(just_pages[i])){
			var page_name = just_pages[i].split('/').slice(-1)[0].replace(/^\d+\-/,'').replace(/\..*?$/,'');
			if ((page_name.length < best_match.length) || (best_match.length == 0)) {
				best_match = page_name;
				return_url = just_pages[i]
			}
		} 
	}
	return return_url;
}

// Do shortcut replacement in page html content.  (links and stuff)
function process_page(url) {
	var d; 
	var size;
	
	// Convert stuff in {{ }} to page transition (use for internal links) example: {{page/test.html}}
	
	d = data.replace(/{{.*}}/gi, function myFunction(x){
		var parts = x.replace(/{{/g,'').replace(/}}/g,'').split('|');
		
        // Blank - Skip any helpers that contain five sequential spaces.  This is so we can document the helpers format without it being replaced.  HTML merges the spaces.
        if (/\s\s\s\s\s/.test(x)) {
        	return x.replace(/\s+/,' ')
        }
        
        // Remove Blanks
        for (i=0; i < parts.length; i++) {parts[i] = parts[i].trim().toLowerCase()}
        
		// Anchors
		if (parts[0]=='a' && parts.length == 2) {
			return "<a onclick=\"loadPage(\'" + pageMatch(parts[1]) + "\')\">"+pageMatch(parts[1])+"</a>";
		}
		if (parts[0]=='a' && parts.length == 3) {
			return "<a onclick=\"loadPage(\'" + pageMatch(parts[1]) + "\')\">"+parts[2]+"</a>";
		}
		if (parts[0]=='a' && parts.length == 4) {
			return "<a onclick=\"loadPage(\'" + pageMatch(parts[1]) + "\')\" alt=\"" + parts[3] + "\">"+parts[2]+"</a>";
		}
		
		// Images
		if (parts[0]=='i' && parts.length == 2) {
			return "<img src=\"" + imageMatch(parts[1]) + "\" alt=\"" + imageMatch(parts[1]) + "\">";
		}
		if (parts[0]=='i' && parts.length == 3) {
			return "<img src=\"" + imageMatch(parts[1]) + "\" alt=\"" + parts[2] + "\">";
		}
		if (parts[0]=='i' && parts.length == 4) {
			return "<img src=\"" + imageMatch(parts[1]) + "\" alt=\"" + parts[2] + "\" class=\"" + parts[3] + "\">";
		}
		if (parts[0]=='i' && parts.length == 5) {
			return "<img src=\"" + imageMatch(parts[1]) + "\" alt=\"" + parts[2] + "\" class=\"" + parts[3] + "\" style=\"" + parts[4] + "\">";
		}
		
		// Carousel {{ carousel:speed | image1:alt1:caption1 | image2:alt2:caption2 | image3:alt3:caption3 }}
		if (parts[0].includes('carousel') && parts.length > 2) {
			var idn = Math.floor(rand(9999999999));
			var carousel_images = parts.slice(1);
			var carousel_speed = 5000
			if (parts[0].split(':').length == 2) {carousel_speed = parseInt(parts[0].split(':')[1])}
			
			// Build the repeating parts of the carousel
			var carousel_indicators = "";
			var slides = "";
			for (ii=0; ii < carousel_images.length; ii++) {
				carousel_indicators += "<li data-target=\"#carousel_"+idn+"\" data-slide-to=\""+ii+"\" class=\""+ (ii==0 ? 'active' : '') +"\"></li>";
				
				var image_parts = carousel_images[ii].split(':');
				var slide_image;
				var slide_caption;
				var slide_alt;
				(image_parts.length > 0) ? slide_image = image_parts[0] : slide_image = "";
				(image_parts.length > 1) ? slide_alt = image_parts[1] : slide_alt = "";
				(image_parts.length > 2) ? slide_caption = image_parts[2] : slide_caption = "";
				slides += 	"<div class=\"item "+ (ii==0 ? 'active' : '') +"\">" +
							"<img src=\""+ imageMatch(slide_image) +"\" alt=\""+ slide_alt  +"\">" +
							"<div class=\"carousel-caption\">"+slide_caption+"</div></div>";
			}
			
			// Wait a second then start the carousel.
			setTimeout(function(){
				$("#carousel_"+idn).carousel({interval: carousel_speed});	
			},1000);
			
			// Return the Carousel
			return 	"<div id=\"carousel_"+idn+"\" class=\"carousel slide auto\" data-ride=\"carousel\">" +
					"<ol class=\"carousel-indicators\">"+carousel_indicators+"</ol>" +
					"<div class=\"carousel-inner\" role=\"listbox\">" + slides + "</div>" +
					"<a class=\"left carousel-control\" href=\"#carousel_"+idn+"\" role=\"button\" data-slide=\"prev\">" +
					"<span class=\"glyphicon glyphicon-chevron-left\" aria-hidden=\"true\"></span><span class=\"sr-only\">Previous</span></a>" +
					"<a class=\"right carousel-control\" href=\"#carousel_"+idn+"\" role=\"button\" data-slide=\"next\">" +
					"<span class=\"glyphicon glyphicon-chevron-right\" aria-hidden=\"true\"></span><span class=\"sr-only\">Next</span></a>" +
					"</div>"
		}
		
		// {{filelist | directory}}
		if (parts[0] == 'filelist' && parts.length == 2) {
			var level = 0;
			var rstring = "";
			var list =  $.grep(pages, function(n,i){return (n.indexOf(parts[1]) > -1) && (!/\/layout\.html$/.test(n))}).sort();
			list.shift(); // Don't show the first directory.
			
			// Convert the list to a hash with the name and the url
			for (var i = 0; i < list.length; i++) {
				var fname = list[i].replace(/\/$/,'')
				fname = fname.split("/")[fname.split("/").length-1];
				fname = fname.replace(/\.md$|\.html$/,'').replace(/^\//,'').replace(/\/$/,'');
				fname = fname.replace(/\d+-/,'');
				fname = fname.replace(/_/g,' ')
				list[i] = {name: fname,url: list[i].replace(/\/$/,'')}
			}
			
			// Remove any empty strings that are left in the list
			list = $.grep(list, function(n,i){return n.name != ""});
			
			var rootList = $("<ul>")
		    var elements = {};
		    $.each(list, function() {
		        var parent = elements[this.url.substr(0, this.url.lastIndexOf("/"))];
		        var list = parent ? parent.children("ul") : rootList;
		        if (!list.length) {
		            list = $("<ul>").appendTo(parent);
		        }
		        var item = $("<li>").appendTo(list);
		        if (!/\.html|\.md/.test(this.url)) {
		        	$("<a>").attr("href", "#").attr('class','folder').text(this.name).appendTo(item);	
		        } else {
		        	$("<a>").attr("onclick", "loadPage(\""+this.url+"\")").attr('class','file').text(this.name).appendTo(item);
		        }
		        elements[this.url] = item;
		    });
		    
			return "<ul class=\"filelist\">" + rootList.html() + "</ul>";
		}
		
		// {{blog | directory}}
		if (parts[0] == 'blog' && parts.length == 2) {
			var blog_list = $.grep(just_pages, function(n,i){return n.toLowerCase().indexOf(parts[1].toLowerCase()) > -1 && /\.html$|\.md$/i.test(n) }).sort();
			for (var i=0; i< blog_list.length; i++) {
				var blog_name = blog_list[i].split("/").slice(-1)[0].replace(/\.html$|\.md$/gi,'').replace(/_/g," ");
				var blog_date_parts = /(\d+)-(\d+)-(\d+)(-(\d+)-)?/g.exec(blog_name);
				var blog_date;
				if (blog_date_parts != null) { 
					blog_date = new Date(blog_date_parts.slice(1,4).join('-')) 
					blog_name = blog_name.split('-').slice(-1)[0];
				}
				blog_list[i] = {name: blog_name, date: blog_date, url: blog_list[i]}
			}
			
			var output = "";
			for (var i=0; i < blog_list.length; i++){
				output += "<div class=\"blog_entry\" data-url=\""+blog_list[i].url+"\">"
				output += "<h1>"+blog_list[i].name+"</h1><time>"+blog_list[i].date.toLocaleDateString()+"</time></div>"
			}
			
			return "<div class=\"blog_list\">"+output+"</div>"
		}
		
		// If all else fails return the original tag.
		return "{{"+parts.join("|")+"}}"
	});
	
	return d
}

// Define functions for load transitions.
function loadPageBasic(data,url) {
	$("main").html( data );
}

function loadPageSlide(data,url) {
	$("#b").html( data )
	in_transition = true;
	
	if (menuIndex(url) > menuIndex(current_page)) {
		$("#a").hide("slide", { direction: "left"}, 500);
		$("#b").show("slide", { direction: "right", complete: function(){
			in_transition = false;
			current_page = url;
			$("#a").html($('#b').html());
			$("#a").show();
			$("#b").hide();
		}}, 500);
	} else if (menuIndex(url) < menuIndex(current_page) && menuIndex(url) != -1) {
		$("#a").hide("slide", { direction: "right"}, 500);
		$("#b").show("slide", { direction: "left", complete: function(){
			in_transition = false;
			current_page = url;
			$("#a").html($('#b').html());
			$("#a").show();
			$("#b").hide();
		}}, 500);
	} else {
		$("#a").hide("fade", { }, 500);
		$("#b").show("fade", { complete: function(){
			  in_transition = false;
			  current_page = url;
			  $("#a").html($('#b').html());
			  $("#a").show();
			  $("#b").hide();
		}}, 500);
	}
		  
}

function lastLayout(filename) {
	var pieces = filename.split("/")
	for (i=1; i < pieces.length; i++) {
		var name = pieces.slice(0,pieces.length-i).concat(["layout.html"]).join("/")
		if ($.inArray(name, layouts) > -1) { return name }
	}
	
	return pieces.slice(0,-1).concat(["layout.html"]).join("/")
}

function loadInsert(fname,insert_location,callback) {
	
	console.log(fname);
	$.get(fname,function(insert_contents){
		var layout_url = lastLayout(fname);
		$.get( layout_url )
			.always(function( layout ) {
				
				// If there is a layout then insert the data into the layout
				if (typeof(layout) != "object") {
					insert_contents = layout.replace(/{{content}}/gi, function myFunction(x){
						if (/\.md/.test(fname)){ insert_contents = marked(insert_contents);	}
						return insert_contents;
					});
				}

				// Insert the contents of each file into data -- invalidate insertion patterns in content of replacement file until async is done.
				data = data.replace(insert_location,insert_contents.replace(/{{/,'@@@@@').replace(/}}/,'#####'))
				
				// Run Callback if it exists
				if (callback && typeof(callback) === "function") {callback();}	
			});
	});
};

function processInserts(callback) {
	
	var insert_list = data.match(/{{\s{0,4}insert.*?}}/gi); // skip if more than 5 spaces at the beginning for documentation purposes.

	// If ther are no callbacks then done.
	if (insert_list == null) {callback(); return}
	var rcount = insert_list.length;

	// Load all the files in the insert list
	for (var i=0; i < insert_list.length; i++) {
		var fname =  pageMatch(insert_list[i].replace(/[{}\s]/g,'').split("|")[1]);
		loadInsert(fname,insert_list[i],function(){
			rcount--;
			
			// Run Callback if it exists
			if (rcount == 0 && callback && typeof(callback) === "function") {
				data = data.replace(/@@@@@/,'{{').replace(/#####/,'}}');
				
				// If there are more inserts in the new version then recurse.
				var more_inserts = data.match(/{{\s*insert.*?}}/gi);
				if (more_inserts) {
					processInserts(function(){
						callback();
					})
				} else {
					callback();
				}
			}
		});
	}
}

// Set load_transition variable at top to set transition type for page loads.
function loadPage(url,save) {
	highlightMenu(url);
	
	$.get( url, function(d) {
		var layout_url = lastLayout(url);
		$.get( layout_url )
			.always(function( layout ) {
				
				// If there is a layout then insert the data into the layout
				if (typeof(layout) != "object") {
					data = layout.replace(/{{content}}/gi, function myFunction(x){
						if (/\.md/.test(url)){ d = marked(d); }
						return d;
					});
				} else {
					data = d;
				}
				
				processInserts( function(){
		
					// Filter content through markdown if the file extension is .md
					if (/\.md/.test(url)){ 
						data = marked(data); 
					}
					
					// Process the helpers in the resulting page/layout
					data = process_page( url );
					
					// Render the appropriate page transition effect.
					switch(load_transition) {
						case 'basic':
							loadPageBasic(data,url)
							break;
						case 'slide':
							loadPageSlide(data,url);
							break;
						default:
							loadPageBasic(data,url);
					}
					
					// Store the URL of the current page in the history 
					if (save == undefined || save == true) {
						var old_url = window.location.href
						var new_url = base_url+'?page='+url.replace(/^\.\//,'');
						window.history.pushState({page: new_url},'test',new_url);
					}
				});			
			});
	});
};

function fileToClass(n){
	return n.replace(/\/$/,'').replace(/[\.|\\|\/|\s]/g,'-');
}

function highlightMenu(fn) {
	var c = fn;
	if (fn.split('/').length > 4){ c = fn.split('/').slice(0,4).join('/');}
	
    c = fileToClass(c);
	$('#menu li').removeClass('active');
	$('.'+c).addClass('active');
}

// Put the pages in the menu (can only be two levels deep)
function makemenu() {
    $.each(menus, function(index,file){
    	if (file.split("/").length < 6) { // Only go two levels deep in the menu structure.
    	
	    	var filename = file;
	    	filename = filename.replace(/\.\/pages\/menus\//,'');   // Remove ./pages from beginning
	    	filename = filename.replace(/\d+\-/,'');       			// Remove any digits followed by a dash at the beginning (use for sort)
	    	filename = filename.replace(/\.html$/,'');     			// Remove .html from end.
	    	filename = filename.replace(/\.md$/,''); 
	    	filename = filename.replace(/_/g,' ');
	    	
	    	classname = fileToClass(file);
	
	    	if (/\/$/.test(filename)) { 
	    		// It is a directory
	    		$('#menu').append(
	    			'<li class="dropdown '+classname+'"><a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">'
	    			+ filename.replace(/\/$/,'')
	    			+ '<span class="caret"></span></a><ul class="dropdown-menu" id="'+filename+'"></ul></li>'
	    		);
	    	} else {
	    		// It is a file
	    		var parts = filename.split('/');
	    		if (parts.length > 1) {
	    			$('#'+parts[0]+'\\\/').append('<li class="file '+classname+'"><a onclick="loadPage(\''+file.replace(/\//g,'\\\/')+'\');">'+parts[1].replace(/\d+\-/,'')+'</a></li>');
	    		} else {
					$('#menu').append('<li class="file '+classname+'"><a onclick="loadPage(\''+file.replace(/\//g,'\\\/')+'\');">'+filename+'</a></li>');
	    		}
	    	}
    	}
	});
}

// Back button clicked
$(window).on("popstate", function(e) {
	page = e.originalEvent.state.page
    loadPage('./' + /(.*)\?page\=(.*)/.exec(page)[2],false); // the part after the ?page=
});



// When the page is loaded.
$( document ).ready(function() {
	
	// Get the directory listings.
	load_pages('./pages');
	load_images('./images');
	if (typeof(default_background) != 'undefined') {load_themes('./themes');}
	
    // Home on Brand Click
    $('.navbar-brand').click(function(){
    	current_page = menu_pages[0];
		loadPage(current_page, true);
    });
    
    // Setup Swipe Events
	$("#a").on("swiperight",function(event){
		if (mpIndex(current_page) > 0  && !in_transition){
			loadPage(menu_pages[mpIndex(current_page)-1],true);
		}
	});
	$("#a").on("swipeleft",function(event){
		if (mpIndex(current_page) < menu_pages.length && !in_transition){
			loadPage(menu_pages[mpIndex(current_page)+1],true);
		}
	});
	
	// Detect keypress
	$(function(){
    	$('html').keydown(function(e){
        
        // left key
        if (e.keyCode == 39 && !in_transition) {
        	if (mpIndex(current_page) < menu_pages.length){
				loadPage(menu_pages[mpIndex(current_page)+1],true);
        	}
		}
        
        // right key
        if (e.keyCode == 37 && !in_transition) {
        	if (mpIndex(current_page) > 0){
				loadPage(menu_pages[mpIndex(current_page)-1],true);
        	}
		}
    });
    
});
	
	// Fix background glitch on mobile devices when address bar hides / unhides.
	$('#background').height(jQuery(window).height() + 120);
	window.onresize = function(){$('#background').height(jQuery(window).height() + 120)}; // not sure uf this works on iphone may need to use orientationchange event.
});