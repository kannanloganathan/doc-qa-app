import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // loads .env file

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ask', async (req, res) => {
    console.log('Key loaded:', process.env.ANTHROPIC_API_KEY ? 'YES' : 'NO');
    console.log('Request body size:', JSON.stringify(req.body).length, 'chars');
  
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          ...req.body,
          stream: false,
        }),
      });
  
      console.log('Anthropic responded with status:', response.status);
      const text = await response.text(); // read as raw text first
      console.log('Raw response (first 500 chars):', text.slice(0, 500));
  
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (parseErr) {
        console.error('JSON parse failed:', parseErr.message);
        res.status(500).json({ error: 'Failed to parse Anthropic response', raw: text.slice(0, 300) });
      }
  
    } catch (err) {
      console.error('Fetch error:', err);
      res.status(500).json({ error: err.message });
    }
  });

app.listen(3001, () => console.log('Proxy running on http://localhost:3001'));