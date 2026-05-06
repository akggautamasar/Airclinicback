const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /prescriptions?patient_id=xxx
router.get('/', async (req, res) => {
  const { patient_id } = req.query;

  let query = supabase
    .from('prescriptions')
    .select(`*, patients (id, name, age, phone)`)
    .eq('doctor_id', req.doctorId)
    .order('created_at', { ascending: false });

  if (patient_id) query = query.eq('patient_id', patient_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ prescriptions: data });
});

// GET /prescriptions/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('prescriptions')
    .select(`*, patients (*), doctors (name, clinic_name, phone, specialty, license_number)`)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .single();

  if (error) return res.status(404).json({ error: 'Prescription not found' });
  res.json({ prescription: data });
});

// POST /prescriptions — create prescription
// medicines: [{ name, dosage, frequency, duration, instructions }]
router.post('/', async (req, res) => {
  const { appointment_id, patient_id, diagnosis, medicines, advice, follow_up_days } = req.body;

  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      doctor_id: req.doctorId,
      appointment_id, patient_id, diagnosis,
      medicines: medicines || [],
      advice, follow_up_days
    })
    .select(`*, patients (name, age), doctors (name, clinic_name, specialty)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // If appointment_id provided, mark appointment as completed
  if (appointment_id) {
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointment_id)
      .eq('doctor_id', req.doctorId);
  }

  res.status(201).json({ prescription: data });
});

// PUT /prescriptions/:id
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('prescriptions')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ prescription: data });
});

module.exports = router;
