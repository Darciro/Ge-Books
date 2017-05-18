'use strict';
document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		console.log( chrome.runtime.getURL('options.html').replace('options.html', '') );
		EPUBJS.filePath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/js/';
		EPUBJS.cssPath = chrome.runtime.getURL('options.html').replace('options.html', '') + 'assets/css/';
        
		// Initialize collapse button
		$('.button-collapse').sideNav();
		// Initialize modal plugin
		$('.modal').modal();
    }
};

var getCurrentPage;
function restoreGeBookPage() {
	chrome.storage.sync.get({
		page: 1,
	}, function(saved) {
		getCurrentPage = saved.page;
	});
}
document.addEventListener('DOMContentLoaded', function() {
	restoreGeBookPage();

	var xhr = new XMLHttpRequest();
	xhr.addEventListener("progress", updateProgress, false);
	xhr.addEventListener("error", transferFailed, false);
	xhr.addEventListener("abort", transferCanceled, false);
	xhr.addEventListener("load", transferComplete, false);

	xhr.open("GET", chrome.extension.getURL('/assets/ge-books/o-pistoleiro-i.epub'), true);
	xhr.send();

	function updateProgress (oEvent) {
		if (oEvent.lengthComputable) {
			var percentComplete = oEvent.loaded / oEvent.total;
	    	// console.log(percentComplete);
		} else {
	    	console.error('Ops....');
		}
	}

	function transferFailed(evt) {
		console.error("Um erro ocorreu durante a transferência do arquivo.");
	}

	function transferCanceled(evt) {
		console.error("A transferência foi cancelada pelo usuário.");
	}

	function transferComplete(evt) {
		console.log("A transferência foi concluída.");
		var Book = ePub({
			bookPath : xhr.responseURL,
			version: 1,
			restore: true,
			storage: false,
			spreads: true,
			fixedLayout : false,
			// styles : { body: 'color: red;' },
			width : 890,
			height: 600,
		});
		// Book.setStyle('padding', '0 40px');
		// window.reader = ePubReader(xhr.responseURL);
		var controls 		= document.getElementById('controls');
		var currentPage 	= document.getElementById('current-page');
		var totalPages 		= document.getElementById('totalpg');
		var slider 			= document.createElement('input');
		// var percentComplete = document.getElementById('read-percent');
		var pageList;
		var slide = function(){
			Book.gotoPage(slider.value);
		};
		var mouseDown = false;

		Book.getMetadata().then(function(meta){
		    // console.log( 'meta', meta );
		    document.getElementById('ge-book-name').textContent = meta.bookTitle;
		});

		Book.getToc().then(function(toc){
			$.each( toc, function( key, value ) {
				// console.log( key, value );
				var tocRow = '<a href="'+ value.cfi +'" class="collection-item toc-link modal-close">'+ value.label +'</a>';
				$('#toc-wrapper').append(tocRow);
			});
		});

		Book.generatePagination().then(function (e) {
		    // console.log("The pagination has been generated", e);
		    console.log('The pagination has been generated');
		});

		Book.on('book:pageChanged', function(location){
		    // console.log( 'pageChanged', location );
		    saveGeBookPage( Book.getCurrentLocationCfi() );
		    if(!mouseDown) {
		    	slider.value = location.anchorPage;
		    }
		    currentPage.value = location.anchorPage;
		    calculatePercentageComplete( location.anchorPage, Book.pagination.totalPages );
		});

		var rendered = Book.renderTo('area');

		// Wait for the pageList to be ready and then show slider
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
            	calculatePercentageComplete( curPage, Book.pagination.totalPages );
            	$('#progress-bar').hide();
            	$('#ge-book-wrapper').removeClass('hide');
            });
            controls.appendChild(slider);
            totalPages.innerText = Book.pagination.totalPages;
            currentPage.addEventListener('change', function(){
            	Book.gotoPage(currentPage.value);
            }, false);
        });

		Book.on('book:ready', function() {
			// console.log('Book ready, opening page:', getCurrentPage);
		  	Book.displayChapter(getCurrentPage);

		  	$(document).on('click', '.toc-link', function(e){
		  		e.preventDefault();
		  		Book.displayChapter($(this).attr('href'));
		  	})

		  	$('#send-epub-form').on('submit', function(e){
		    	e.preventDefault();

		        var file_name = $('#ebub-file').val(),
		        	file_data = $('#ebub-file').prop('files')[0],
		        	form_data = new FormData(),
		        	extension = file_name.replace(/^.*\./, '');
		        
		        	form_data.append(file_name, file_data);
		        
		        console.log( file_name, form_data, file_data )

		        if( extension === 'epub' ){
		    		console.log('Sending file_name...', file_name);
		    		console.log('Sending form_data...', form_data);
		    		console.log('Sending file_data...', file_data);

		    		if (window.FileReader) {
		                var reader = new FileReader();
		                reader.onload = function (e) {
		                    Book.destroy();
		                    // Book = ePub({bookPath: e.target.result});
		                    Book = ePub({
		                    	bookPath : e.target.result,
		                    	version: 1,
		                    	restore: true,
		                    	storage: false,
		                    	spreads: true,
		                    	fixedLayout : false,
		                    	width : 890,
		                    	height: 600,
		                    });
		                    Book.renderTo('area');
		                    $('#upload-modal').modal('close');
		                }.bind(this);
		                reader.readAsArrayBuffer(file_data);
		            }
	            }
            });
		});

		document.querySelector('#ge-book-prev').addEventListener('click', function(e) {
			e.preventDefault();
			Book.prevPage();
		});

		document.querySelector('#ge-book-next').addEventListener('click', function(e) {
			e.preventDefault();
			Book.nextPage();
		});
	}

	function calculatePercentageComplete( curr, total ){
		var percentComplete = document.getElementById('read-percent');
		percentComplete.textContent = ( ( curr / total ) * 100 ).toFixed(2) + '%';
	}

	function saveGeBookPage(page) {
		chrome.storage.sync.set({
			page: page
		}, function() {
			// console.log( 'Pagina atual: ', page );
		});
	}

	$(document).on('change', '#ebub-file', function(){
		if( $(this).val().replace(/^.*\./, '') === 'epub' ){
			console.log('Epub file found');
		} else {
			console.error('Epub NOT found');
		}
	});

});
