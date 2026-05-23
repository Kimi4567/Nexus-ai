async function generateVideo(button) {
    const prompt = document.getElementById('videoPrompt').value;
    console.log('Prompt entered:', prompt);
    
    if (!prompt.trim()) {
        console.warn('Prompt is empty');
        return;
    }

    const btn = button || document.querySelector('button[onclick="generateVideo(this)"]');
    const resultMessage = document.getElementById('resultMessage');
    const videoPreview = document.getElementById('videoPreview');
    const downloadButton = document.getElementById('downloadButton');
    const videoResult = document.getElementById('videoResult');

    console.log('Elements found:', { resultMessage, videoPreview, downloadButton, videoResult });

    if (resultMessage) {
        resultMessage.classList.add('hidden');
        resultMessage.textContent = '';
    }
    if (videoPreview) {
        videoPreview.pause();
        videoPreview.removeAttribute('src');
        videoPreview.load();
        videoPreview.classList.add('hidden');
    }
    if (downloadButton) {
        downloadButton.classList.add('hidden');
        downloadButton.onclick = null;
    }
    if (videoResult) {
        videoResult.classList.add('hidden');
    }

    btn.innerHTML = 'Generating video... (30-60 seconds)';
    btn.disabled = true;
    console.log('Button state changed to generating');

    try {
        console.log('Fetching /api/generate with prompt:', prompt);
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        console.log('Response status:', response.status);
        const prediction = await response.json();
        console.log('Response data:', prediction);

        if (!response.ok || prediction.error) {
            const message = prediction?.error || 'Unable to generate video. Please try again.';
            console.error('API Error:', message);
            if (resultMessage) {
                resultMessage.textContent = message;
                resultMessage.classList.remove('hidden');
            } else {
                alert(message);
            }
            btn.innerHTML = 'Generate Video';
            btn.disabled = false;
            return;
        }

        const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        const videoUrl = typeof output === 'string' ? output : output?.[0] || null;
        console.log('Video URL:', videoUrl);

        if (!videoUrl) {
            const message = 'No video URL returned from the server.';
            console.error(message);
            if (resultMessage) {
                resultMessage.textContent = message;
                resultMessage.classList.remove('hidden');
            } else {
                alert(message);
            }
            btn.innerHTML = 'Generate Video';
            btn.disabled = false;
            return;
        }

        if (videoPreview) {
            console.log('Setting video preview source:', videoUrl);
            videoPreview.src = videoUrl;
            videoPreview.classList.remove('hidden');
            videoPreview.load();
        }

        if (downloadButton) {
            console.log('Setting download button');
            downloadButton.classList.remove('hidden');
            downloadButton.onclick = () => {
                console.log('Opening video in new tab:', videoUrl);
                window.open(videoUrl, '_blank');
            };
        }

        if (videoResult) {
            console.log('Showing video result');
            videoResult.classList.remove('hidden');
        }

        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
        console.log('Success!');
    } catch (error) {
        const message = error?.message || 'An unexpected error occurred.';
        console.error('Exception:', error);
        if (resultMessage) {
            resultMessage.textContent = message;
            resultMessage.classList.remove('hidden');
        } else {
            alert(message);
        }
        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    }
}
