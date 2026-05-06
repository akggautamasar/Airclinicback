const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticate = require('../middleware/auth');

// All routes require auth
router.use(authenticate);

// GET /patients — list all patients for this doctor
router.get('/', async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .eq('doctor_id', req.doctorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return res.status(400).json({ error: error.message });

  res.json({ patients: data, total: count, page: Number(page), limit: Number(limit) });
});

// GET /patients/:id — single patient with history
router.get('/:id', async (req, res) => {
  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .single();

  if (error) return res.status(404).json({ error: 'Patient not found' });

  // Get last 5 appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', req.params.id)
    .order('appointment_date', { ascending: false })
    .limit(5);

  // Get last 5 prescriptions
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(5);

  res.json({ patient, appointments, prescriptions });
});

// POST /patients — create patient
router.post('/', async (req, res) => {
  const {
    name, age, date_of_birth, gender, phone, email,
    address, blood_group, allergies, chronic_conditions,
    emergency_contact, emergency_phone, notes
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Patient name is required' });

  const { data, error } = await supabase
    .from('patients')
    .insert({
      doctor_id: req.doctorId,
      name, age, date_of_birth, gender, phone, email,
      address, blood_group, allergies, chronic_conditions,
      emergency_contact, emergency_phone, notes
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ patient: data });
});

// PUT /patients/:id — update patient
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('patients')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ patient: data });
});

// DELETE /patients/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Patient deleted' });
});

module.exports = router;
