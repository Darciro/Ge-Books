var uploadUrl = 'https://www.example.com/uploads';

/* Creates an `input[type="file]` */
var fileChooser = document.createElement('input');
fileChooser.type = 'file';
fileChooser.addEventListener('change', function () {
	var file = fileChooser.files[0];
	var formData = new FormData();
	formData.append(file.name, file);

	var xhr = new XMLHttpRequest();
	xhr.open('POST', uploadUrl, true);
	xhr.addEventListener('readystatechange', function (evt) {
		console.log('ReadyState: ' + xhr.readyState,
			'Status: ' + xhr.status);
	});

	xhr.send(formData);
    form.reset();   // <-- Resets the input so we do get a `change` event,
                    //     even if the user chooses the same file
});

/* Wrap it in a form for resetting */
var form = document.createElement('form');
form.appendChild(fileChooser);

/* Listen for messages from popup */
chrome.runtime.onMessage.addListener(function (msg) {
	if (msg.action === 'browseAndUpload') {
		fileChooser.click();
	}
});