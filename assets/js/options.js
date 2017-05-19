'use strict';
 /**
  * Configura as variáveis globais
  *
  */
var app, 
	utils,
	getCurrentPage,
	savedData 		= [], 
	sendGbookForm 	= document.getElementById('send-epub-form'),
	geBook 			= ePub(),
	geBookIsActive 	= false,
	geBookArea 		= { width : 890, height: 600 },
	geBookNextPage 	= document.getElementById('ge-book-next'),
	geBookPrevPage 	= document.getElementById('ge-book-prev'),
	controls 		= document.getElementById('controls'),
	currentPage 	= document.getElementById('current-page'),
	totalPages 		= document.getElementById('totalpg'),
	slider 			= document.createElement('input'),
	mouseDown 		= false,
	pageList;

/**
 * Restore previously saved data 
 * 
 * @return {Object}
 */
function restoreGeBookPage() {
	// Clear all data synced
	 /*chrome.storage.sync.clear(function() {
	    var error = chrome.runtime.lastError;
	    if (error) {
	        console.error(error);
	    }
	}); */ 

	chrome.storage.sync.get(function(dataRetrieved) {
		console.log('Raw data', dataRetrieved);
		savedData = dataRetrieved;
		/*if( dataRetrieved.savedData ){
			console.log('dataRetrieved', dataRetrieved.savedData);
			getCurrentPage = dataRetrieved.savedData.lastPage;
		} else {
			console.log('dataRetrieved empty');;
		}*/
	});
}

/**
 * Wait until the document is ready to rock and start application
 * 
 * @return {Void}
 */
document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		restoreGeBookPage();
		startApplication();
    }
};

/**
 * The application main features
 * 
 * @return {Void}
 */
function startApplication () {
	(function ($) {
		app = {
	        init: function () {
	        	// @TODO - REMOVER
	            console.info('Initializing application');

	            EPUBJS.filePath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/js/';
	            EPUBJS.cssPath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/css/';


	            utils.helpers();
	            app.geBookFileSwitcher();
	        },

	        geBookFileSwitcher: function () {
	        	$(sendGbookForm).on('submit', function(e){
			    	e.preventDefault();

			        var file_name = $('#ebub-file').val(),
			        	file_data = $('#ebub-file').prop('files')[0],
			        	form_data = new FormData(),
			        	extension = file_name.replace(/^.*\./, '');
			        
			        	form_data.append(file_name, file_data);
			        
			        // console.log( file_name, form_data, file_data )

			        if( extension === 'epub' ){
			    		console.log('Sending file_name...', file_name);
			    		console.log('Sending form_data...', form_data);
			    		console.log('Sending file_data...', file_data);

			    		if (window.FileReader) {
			                var reader = new FileReader();
			                reader.onload = function (e) {
			                	if( geBookIsActive ){
			                		geBook.destroy();
			                	}
			                    geBook = ePub({
			                    	bookPath : e.target.result,
			                    	version: 1,
			                    	restore: false,
			                    	storage: false,
			                    	online: false,
			                    	spreads: true,
			                    	packageUrl: false,
			                    	fixedLayout : false,
			                    	width : geBookArea.width,
			                    	height: geBookArea.height,
			                    });
			                    geBookIsActive = true;

			                    $('#upload-modal').modal('close');
			                    app.geBookRender(geBook);

			                }.bind(this);
			                reader.readAsArrayBuffer(file_data);
			            }
		            }
				});
	        },

	        geBookRender: function (Book) {
	        	app.getGebookMetadata(Book);
	        	app.generateGebookToc(Book);
	        	app.generateGebookPagination(Book);
	        	app.geBooPagination(Book);
	        	app.showGebookReady(Book);
	        },

	        getGebookMetadata: function (Book) {
	        	Book.getMetadata().then(function(meta){
	        	    // console.log( 'meta', meta );
	        	    document.getElementById('ge-book-name').textContent = meta.bookTitle;
	        	});
	        },

	        generateGebookToc: function (Book) {
	        	$('#toc-wrapper').html('');
	        	Book.getToc().then(function(toc){
    				$.each( toc, function( key, value ) {
    					// console.log( key, value );
    					var tocRow = '<a href="'+ value.cfi +'" class="collection-item toc-link modal-close">'+ value.label +'</a>';
    					$('#toc-wrapper').append(tocRow);
    				});
    			});
	        },

	        generateGebookPagination: function (Book) {
	        	Book.generatePagination().then(function (e) {
    			    // console.log("The pagination has been generated", e);
    			    console.log('The pagination has been generated');
    			});

    			Book.on('book:pageChanged', function(location){
    			    // console.log( 'pageChanged', location );
    			    if(!mouseDown) {
    			    	slider.value = location.anchorPage;
    			    }
    			    currentPage.value = location.anchorPage;
    			    utils.calculatePercentageComplete( location.anchorPage, Book.pagination.totalPages );

    			    // Save Gebook Data
    			    var data = {};
    			    Book.getMetadata().then(function(meta){
    			        data.geBookName = meta.bookTitle;
    			        data.lastPage = Book.getCurrentLocationCfi()
    			        utils.saveGebookData(data);
    			    });
    			});
	        },

	        showGebookReady: function (Book) {
	        	Book.removeStyle('popup');
	        	var rendered = geBook.renderTo('area');
	        	var slide = function () {
	        		Book.gotoPage(slider.value);
	        	};

    			Book.pageListReady.then(function(pageList){
    				controls.style.display = 'block';
    	            // console.log(JSON.stringify(pageList)); // Save the result
    	            slider.setAttribute('id', 'page-slider');
    	            slider.setAttribute('type', 'range');
    	            slider.setAttribute('min', Book.pagination.firstPage);
    	            slider.setAttribute('max', Book.pagination.lastPage);
    	            slider.setAttribute('step', 1);
    	            slider.setAttribute('value', 0);
    	            slider.addEventListener('change', slide, false);
    	            slider.addEventListener('mousedown', function(){
    	            	mouseDown = true;
    	            }, false);
    	            slider.addEventListener('mouseup', function(){
    	            	mouseDown = false;
    	            }, false);

    	            // Wait for Book to be rendered to get current page
    	            rendered.then(function(){
    	            	var currentLocation = Book.getCurrentLocationCfi();
    	            	var curPage = Book.pagination.pageFromCfi(currentLocation);
    	            	slider.value = curPage;
    	            	currentPage.value = curPage;
    	            	utils.calculatePercentageComplete( curPage, Book.pagination.totalPages );
    	            	$('#progress-bar').hide();
    	            	$('#ge-book-wrapper').removeClass('hide');
    	            	console.log('Book rendered');
    	            	if( savedData.length ){
    	            		console.log('Options saved, searching book');
	            	    	for(var i = 0; i < savedData.length; i++) {
	            	    		if( savedData[i].geBookName === $('#ge-book-name').text() ) {
	            	    			console.log('Book found, loading page');
	            	    			Book.displayChapter(Book.getCurrentLocationCfi());
	            	    		} 
	            	    	}
	            	    } else {
	            	    	console.log('Options not found');
	            	    }
    	            });

    	            controls.appendChild(slider);
    	            totalPages.innerText = Book.pagination.totalPages;
    	            currentPage.addEventListener('change', function(){
    	            	Book.gotoPage(currentPage.value);
    	            }, false);
    	        });
	        },

	        geBooPagination: function (Book) {
	        	$(geBookPrevPage).on('click', function(e) {
	        		e.preventDefault();
	        		Book.prevPage();
	        	});

	        	$(geBookNextPage).on('click', function(e) {
	        		e.preventDefault();
	        		Book.nextPage();
	        	});
	        }
	    },

        utils = {
        	helpers: function () {
	        	// Initialize collapse button
	        	$('.button-collapse').sideNav();
	        	// Initialize modal plugin
	        	$('.modal').modal();
	        },

        	calculatePercentageComplete: function( curr, total ){
				var percentComplete = document.getElementById('read-percent');
				percentComplete.textContent = ( ( curr / total ) * 100 ).toFixed(2) + '%';
			},

			saveGebookData: function (data) {
				console.log('data to saveGebookData', data);
				if( savedData.length ){
					for(var i = 0; i < savedData.length; i++) {
						console.log('savedData', savedData);
						if( savedData[i].geBookName === data.geBookName ) {
							console.log('gebook found!', data.geBookName);
							savedData[i].lastPage = data.lastPage;

							chrome.storage.sync.set({
								geBookData: savedData
							}, function() {
								console.log( 'geBookData updated: ', savedData );
							});

							return;
						} else {
							console.log('Book not found');
							savedData.push(data);
						}
					}
				} else {
					savedData.push(data);
				}


				chrome.storage.sync.set({
					geBookData: savedData
				}, function() {
					console.log( 'geBookData: ', savedData );
				});
			}
        }
	})(jQuery);

	/**
	 * Initialize the application
	 * 
	 * @return {Void}
	 */
	app.init();
}