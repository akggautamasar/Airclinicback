const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// Generate invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}${d}-${rand}`;
}

// GET /bills
router.get('/', async (req, res) => {
  const { patient_id, payment_status, from_date, to_date } = req.query;

  let query = supabase
    .from('bills')
    .select(`*, patients (id, name, phone)`)
    .eq('doctor_id', req.doctorId)
    .order('created_at', { ascending: false });

  if (patient_id) query = query.eq('patient_id', patient_id);
  if (payment_status) query = query.eq('payment_status', payment_status);
  if (from_date) query = query.gte('created_at', from_date);
  if (to_date) query = query.lte('created_at', to_date + 'T23:59:59');

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ bills: data });
});

// GET /bills/summary — revenue stats
router.get('/summary', async (req, res) => {
  const { month, year } = req.query;
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;

  const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('bills')
    .select('total, paid_amount, payment_status, created_at')
    .eq('doctor_id', req.doctorId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59');

  if (error) return res.status(400).json({ error: error.message });

  const summary = {
    total_billed: data.reduce((s, b) => s + Number(b.total), 0),
    total_collected: data.reduce((s, b) => s + Number(b.paid_amount), 0),
    total_pending: data.filter(b => b.payment_status === 'pending').reduce((s, b) => s + Number(b.total), 0),
    invoice_count: data.length,
    paid_count: data.filter(b => b.payment_status === 'paid').length
  };

  res.json({ summary });
});

// GET /bills/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('bills')
    .select(`*, patients (*), doctors (name, clinic_name, phone, clinic_address)`)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .single();

  if (error) return res.status(404).json({ error: 'Bill not found' });
  res.json({ bill: data });
});

// POST /bills — create bill
// items: [{ description, amount }]
router.post('/', async (req, res) => {
  const { appointment_id, patient_id, items, discount = 0, payment_method, paid_amount } = req.body;

  if (!patient_id || !items?.length) {
    return res.status(400).json({ error: 'patient_id and items are required' });
  }

  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
  const total = subtotal - Number(discount);
  const actualPaid = paid_amount !== undefined ? Number(paid_amount) : total;
  const payment_status = actualPaid >= total ? 'paid' : actualPaid > 0 ? 'partial' : 'pending';

  const { data, error } = await supabase
    .from('bills')
    .insert({
      doctor_id: req.doctorId,
      appointment_id, patient_id,
      items, subtotal, discount, total,
      payment_status, payment_method,
      paid_amount: actualPaid,
      invoice_number: generateInvoiceNumber()
    })
    .select(`*, patients (name, phone)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ bill: data });
});

// PUT /bills/:id — update payment
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('bills')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ bill: data });
});

module.exports = router;
