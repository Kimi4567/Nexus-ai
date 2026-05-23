export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Prediction ID is required' });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN environment variable' });
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const prediction = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: prediction?.detail || prediction?.error || 'Failed to fetch prediction status',
      });
    }

    res.status(200).json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
