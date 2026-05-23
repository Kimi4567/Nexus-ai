async function generateVideo(button) {
    const prompt = document.getElementById('videoPrompt').value;
    if (!prompt.trim()) return;

    const btn = button || document.querySelector('button[onclick="generateVideo(this)"]');
    const downloadLink = document.getElementById('downloadLink');
    const videoResult = document.getElementById('videoResult');

    if (downloadLink) {
        downloadLink.classList.add('hidden');
        downloadLink.href = '#';
        downloadLink.textContent = 'Download Video';
        downloadLink.removeAttribute('download');
    }

    if (videoResult) {
        videoResult.classList.add('hidden');
    }

    btn.innerHTML = 'Starting...';
    btn.disabled = true;

    try {
        const startResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        const prediction = await startResponse.json();

        if (prediction.error) {
            alert('Error: ' + prediction.error);
            btn.innerHTML = 'Generate Video';
            btn.disabled = false;
            return;
        }

        const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (output && downloadLink) {
            const videoUrl = typeof output === 'string' ? output : output?.[0] || '#';
            downloadLink.href = videoUrl;
            downloadLink.textContent = 'Download Video';
            downloadLink.classList.remove('hidden');
            downloadLink.onclick = () => window.open(videoUrl, '_blank');
            downloadLink.setAttribute('download', 'video.mp4');
        }

        if (videoResult) {
            videoResult.classList.remove('hidden');
        }

        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    } catch (error) {
        alert('Error: ' + error.message);
        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    }
}
