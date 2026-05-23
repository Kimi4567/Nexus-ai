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

        btn.innerHTML = 'Generating (0%)...';

        const checkStatus = setInterval(async () => {
            try {
                const statusResponse = await fetch(`/api/status?id=${prediction.id}`);
                const result = await statusResponse.json();

                if (result.error) {
                    clearInterval(checkStatus);
                    alert('Error: ' + result.error);
                    btn.innerHTML = 'Generate Video';
                    btn.disabled = false;
                    return;
                }

                if (result.status === 'succeeded') {
                    clearInterval(checkStatus);
                    const output = Array.isArray(result.output) ? result.output[0] : result.output;

                    if (output && downloadLink) {
                        downloadLink.href = typeof output === 'string' ? output : output?.[0] || '#';
                        downloadLink.textContent = 'Download Video';
                        downloadLink.classList.remove('hidden');
                        downloadLink.setAttribute('download', 'video.mp4');
                    }

                    if (videoResult) {
                        videoResult.classList.remove('hidden');
                    }
                    btn.innerHTML = 'Generate Video';
                    btn.disabled = false;
                } else if (result.status === 'failed') {
                    clearInterval(checkStatus);
                    alert('Generation failed. Please try again.');
                    btn.innerHTML = 'Generate Video';
                    btn.disabled = false;
                } else {
                    const progress = result.metrics?.progress;
                    btn.innerHTML = progress ? `Generating (${Math.round(progress * 100)}%)...` : `Generating...`;
                }
            } catch (error) {
                clearInterval(checkStatus);
                alert('Polling failed: ' + error.message);
                btn.innerHTML = 'Generate Video';
                btn.disabled = false;
            }
        }, 3000);
    } catch (error) {
        alert('Error: ' + error.message);
        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    }
}
