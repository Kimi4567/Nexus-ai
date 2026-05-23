async function generateVideo(button) {
    const prompt = document.getElementById('videoPrompt').value;
    if (!prompt.trim()) {
        return;
    }

    const btn = button || document.querySelector('button[onclick="generateVideo(this)"]');
    const resultMessage = document.getElementById('resultMessage');
    const videoPreview = document.getElementById('videoPreview');
    const downloadButton = document.getElementById('downloadButton');
    const videoResult = document.getElementById('videoResult');

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

    btn.innerHTML = 'Generating...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        const prediction = await response.json();

        if (!response.ok || prediction.error) {
            const message = prediction?.error || 'Unable to generate video. Please try again.';
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

        if (!videoUrl) {
            const message = 'No video URL returned from the server.';
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
            videoPreview.src = videoUrl;
            videoPreview.classList.remove('hidden');
            videoPreview.load();
            videoPreview.play().catch(() => {});
        }

        if (downloadButton) {
            downloadButton.classList.remove('hidden');
            downloadButton.onclick = () => {
                window.open(videoUrl, '_blank');
            };
        }

        if (videoResult) {
            videoResult.classList.remove('hidden');
        }

        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    } catch (error) {
        const message = error?.message || 'An unexpected error occurred.';
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
