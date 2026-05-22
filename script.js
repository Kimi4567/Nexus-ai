async function generateVideo() {
    const prompt = document.getElementById('videoPrompt').value;
    if (!prompt.trim()) return;
    
    const btn = event.target;
    btn.innerHTML = 'Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
            btn.innerHTML = 'Generate Video';
            btn.disabled = false;
            return;
        }
        
        document.getElementById('videoResult').classList.remove('hidden');
        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
        
    } catch (error) {
        alert('Error: ' + error.message);
        btn.innerHTML = 'Generate Video';
        btn.disabled = false;
    }
}
