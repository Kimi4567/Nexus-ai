export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        body = {};
      }
    }

    const { prompt } = body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const runwayKey = process.env.RUNWAY_API_KEY;
    if (!runwayKey) {
      return res.status(500).json({
        error: 'RUNWAY_API_KEY not configured. Please set up Runway ML API key in environment variables.',
      });
    }

    const generateResponse = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gen2',
        prompt,
        seconds: 5,
      }),
    });

    const generateData = await generateResponse.json();
    if (!generateResponse.ok) {
      return res.status(generateResponse.status || 500).json({
        error: generateData?.error || 'Failed to generate video with Runway ML',
      });
    }

    const taskId = generateData?.id;
    if (!taskId) {
      return res.status(500).json({ error: 'Runway did not return a task ID' });
    }

    let finalData = generateData;
    const maxWaitTime = 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (finalData.status === 'SUCCEEDED') {
        break;
      }
      if (finalData.status === 'FAILED') {
        return res.status(500).json({
          error: finalData?.error || 'Video generation failed',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${runwayKey}`,
          'Content-Type': 'application/json',
        },
      });

      finalData = await statusResponse.json();
      if (!statusResponse.ok) {
        return res.status(statusResponse.status || 500).json({
          error: finalData?.error || 'Failed to check video status',
        });
      }
    }

    if (finalData.status !== 'SUCCEEDED') {
      return res.status(500).json({
        error: 'Video generation timed out. Please try again with a simpler prompt.',
      });
    }

    const videoUrl = finalData?.output?.[0] || finalData?.url || null;
    if (!videoUrl) {
      return res.status(500).json({ error: 'No video URL in response' });
    }

    return res.status(200).json({
      id: taskId,
      status: 'succeeded',
      output: videoUrl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
