export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=10&active=true&closed=false&order=volume&ascending=false'
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
}
