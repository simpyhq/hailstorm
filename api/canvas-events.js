const CANVAS_TOKEN = '8808~rB2MKzrrZcJUNHFkhAcCRBAmWYRLBGFZNChERaQDwLWzeYcVMDR42kYmantZ3PNw';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  try {
    const response = await fetch(
      'https://canvas.ou.edu/api/v1/users/self/upcoming_events?per_page=10',
      { headers: { Authorization: `Bearer ${CANVAS_TOKEN}` } }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Canvas data' });
  }
}
