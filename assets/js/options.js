'use strict';
 /**
  * Configura as variáveis globais
  *
  */
var app, 
	utils,
	api,
	userID,
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
function restoreGeBookData() {
	/*chrome.storage.sync.get('userid', function(items) {
	    var userid = items.userid;
	    if (userid) {
	        useToken(userid);
	    } else {
	        userid = getRandomToken();
	        chrome.storage.sync.set({userid: userid}, function() {
	            useToken(userid);
	        });
	    }
	    function useToken(userid) {
	        // TODO: Use user id for authentication or whatever you want.
	    }
	});*/
	// Great idea from: https://stackoverflow.com/questions/23822170/getting-unique-clientid-from-chrome-extension#answer-23854032
	function generateTokenID() {
	    // E.g. 8 * 32 = 256 bits token
	    var randomPool = new Uint8Array(32);
	    crypto.getRandomValues(randomPool);
	    var hex = '';
	    for (var i = 0; i < randomPool.length; ++i) {
	        hex += randomPool[i].toString(16);
	    }
	    // E.g. db18458e2782b2b77e36769c569e263a53885a9944dd0a861e5064eac16f1a
	    return hex;
	}

	chrome.storage.sync.get(function(dataRetrieved) {
		console.log('Raw data', dataRetrieved);
		userID = dataRetrieved.userID;
		if( !userID ){
			userID = generateTokenID();
	        chrome.storage.sync.set({'userID': userID}, function() {
	            // useToken(userid);
	        });
		}

		if ( dataRetrieved.geBookData ){
			savedData = dataRetrieved.geBookData;
		} else {
			savedData = [];
		}
		startApplication();
	});
}
restoreGeBookData();


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
	            console.log('Restored data:', savedData);

	            EPUBJS.filePath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/js/';
	            EPUBJS.cssPath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/css/';


	            utils.helpers();
	            utils.clearAllData();
	            app.geBookFileSwitcher();
	            app.welcomeInterface();
	            app.getMyGeBooks();
	        },

	        welcomeInterface: function () {
	        	// body...
	        },

	        geBookFileSwitcher: function () {
	        	$(sendGbookForm).on('submit', function(e){
			    	e.preventDefault();
			    	$('#ge-book-welcome').addClass('hide');
			    	$('#ge-book-wrapper').addClass('hide');
			    	$('#progress-bar').removeClass('hide');

			        var file_name = $('#ebub-file').val(),
			        	file_data = $('#ebub-file').prop('files')[0],
			        	formData = new FormData(),
			        	extension = file_name.replace(/^.*\./, '');

			        	formData.append('file', file_data);
			        	formData.append('userID', userID);

			        if( extension === 'epub' ){
			    		console.log('Sending file_name...', file_name);
			    		console.log('Sending formData...', formData);
			    		console.log('Sending file_data...', file_data);

			    		api.sendGeBook(formData);

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
	        	app.geBookPagination(Book);
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

    			$(document).on('click', '.toc-link', function(e){
    				e.preventDefault();
    				Book.displayChapter($(this).attr('href'));
    			})
	        },

	        generateGebookPagination: function (Book) {
	        	Book.generatePagination().then(function (e) {
    			    // console.log("The pagination has been generated", e);
    			    console.log('The pagination has been generated');
    			});

    			Book.on('book:pageChanged', function(location){
    			    console.log( 'pageChanged', location );
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
    	            	$('#progress-bar').addClass('hide');
    	            	$('#ge-book-wrapper, #ge-book-name-wrapper').removeClass('hide');
    	            	$('#ge-book-welcome').addClass('hide');
    	            	console.log('Book rendered', savedData.length);
    	            	// if( Object.getOwnPropertyNames(savedData).length ){
    	            	if( savedData.length ){
    	            		console.log('Options found, searching for book');
	            	    	for(var i = 0; i < savedData.length; i++) {
	            	    		if( savedData[i].geBookName === $('#ge-book-name').text() ) {
	            	    			console.log('Book found, loading page');
	            	    			Book.displayChapter( savedData[i].lastPage );
	            	    		}else{
	            	    			console.log('Book not found, loading first page');
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

	        geBookPagination: function (Book) {
	        	$(geBookPrevPage).on('click', function(e) {
	        		e.preventDefault();
	        		Book.prevPage();
	        	});

	        	$(geBookNextPage).on('click', function(e) {
	        		e.preventDefault();
	        		Book.nextPage();
	        	});
	        },

	        getMyGeBooks: function (Book) {
	        	$.ajax({
                    url: 'http://192.241.173.116/projetos/ge-books/my-gebooks.php',
                    // dataType: 'json',
                    data: {userID: userID},
                    type: 'GET',
                    /*beforeSend: function(php_script_response){
                    	
                    },*/
                    success: function(booksData){
                    	booksData = JSON.parse(booksData);
                    	console.log(booksData);
                    	$('#my-ge-books-wrapper').html('');
                    	$.each(booksData.geBooks, function(key, book){
                    		var bookRow = '<a href="' + book.path + '" class="collection-item saved-book-link modal-close">'+ book.name +'</a>';
	    					$('#my-ge-books-wrapper').append(bookRow);
                    	});
                    },
                    error: function(error){
                    	console.error( 'Error: ' + error.responseText );
                    	console.error( 'Full stack: ', error );
                	}
             	});

             	$(document).on('click', '.saved-book-link', function(e){
             		e.preventDefault();
             		app.openSavedGeBook($(this).attr('href'));
             	})
	        },

            openSavedGeBook: function (pathToBook) {
        		$('#ge-book-welcome').addClass('hide');
        		$('#ge-book-wrapper').addClass('hide');
        		$('#progress-bar').removeClass('hide');
            	if( geBookIsActive ){
            		geBook.destroy();
            	}
                geBook = ePub({
                	bookPath : pathToBook,
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

                $('#browse-books-modal').modal('close');
                app.geBookRender(geBook);
            },

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
				// if( Object.getOwnPropertyNames(savedData).length ){
				if( savedData.length ){
					for(var i = 0; i < savedData.length; i++) {
						console.log('savedData', savedData);
						if( savedData[i].geBookName == data.geBookName ) {
							console.log('gebook found!', data.geBookName);
							savedData[i].lastPage = data.lastPage;
							// savedData.push(data);
							chrome.storage.sync.set({
								'geBookData': savedData
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
					chrome.storage.sync.set({
						'geBookData': savedData
					}, function() {
						console.log( 'geBookData saved!' );
					});
				}
			},

			clearAllData: function (){
				$('#clear-ge-books-data').on('click', function(){
					chrome.storage.sync.clear(function() {
					    var error = chrome.runtime.lastError;
					    if (error) {
					        console.error(error);
					    } else {
					    	alert('Data cleared!')
					    }
					}); 
				});
			}
        },

        api = {
        	sendGeBook: function (book) {
	        	$.ajax({
                    url: 'http://192.241.173.116/projetos/ge-books/process-gebook.php',
                    // dataType: 'json',
                    dataType: 'text',
                    cache: false,
                    contentType: false,
                    processData: false,
                    data: book,                         
                    type: 'POST',
                    /*beforeSend: function(php_script_response){
                    	
                    },*/
                    success: function(response){
                    	console.log( response );
                    },
                    error: function(error){
                    	console.error( 'Error: ' + error.responseText );
                    	console.error( 'Full stack: ', error );
                	}
                 });
	        },
        }
	})(jQuery);

	/**
	 * Initialize the application
	 * 
	 * @return {Void}
	 */
	$(document).ready(function () {
    	app.init();
    });
}