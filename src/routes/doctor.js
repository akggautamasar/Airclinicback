const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /doctor/profile
router.get('/profile', async (req, res) => {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', req.doctorId)
    .single();

  if (error) return res.status(404).json({ error: 'Doctor profile not found' });
  res.json({ doctor: data });
});

// POST /doctor/profile — create profile after signup
router.post('/profile', async (req, res) => {
  const {
    name, phone, specialty, clinic_name,
    clinic_address, license_number, working_hours, slot_duration_minutes
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('doctors')
    .insert({
      id: req.doctorId,
      email: req.user.email,
      name, phone, specialty, clinic_name,
      clinic_address, license_number,
      working_hours, slot_duration_minutes
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ doctor: data });
});

// PUT /doctor/profile
router.put('/profile', async (req, res) => {
  const { data, error } = await supabase
    .from('doctors')
    .update(req.body)
    .eq('id', req.doctorId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ doctor: data });
});

// GET /doctor/dashboard — summary stats
router.get('/dashboard', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalPatients },
    { data: todayAppts },
    { data: pendingBills },
    { data: recentPatients }
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('doctor_id', req.doctorId),
    supabase.from('appointments').select('*, patients(name, phone)').eq('doctor_id', req.doctorId).eq('appointment_date', today).order('appointment_time'),
    supabase.from('bills').select('total, paid_amount').eq('doctor_id', req.doctorId).eq('payment_status', 'pending'),
    supabase.from('patients').select('id, name, phone, created_at').eq('doctor_id', req.doctorId).order('created_at', { ascending: false }).limit(5)
  ]);

  const pendingAmount = (pendingBills || []).reduce((s, b) => s + Number(b.total) - Number(b.paid_amount), 0);

  res.json({
    stats: {
      total_patients: totalPatients,
      todays_appointments: todayAppts?.length || 0,
      pending_amount: pendingAmount,
      completed_today: todayAppts?.filter(a => a.status === 'completed').length || 0
    },
    todays_appointments: todayAppts || [],
    recent_patients: recentPatients || []
  });
});

module.exports = router;
