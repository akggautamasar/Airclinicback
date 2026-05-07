const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /public/clinic/:code — get clinic info by code (no auth)
router.get('/clinic/:code', async (req, res) => {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, name, specialty, clinic_name, clinic_address, slot_duration_minutes, working_hours, avatar_url')
    .eq('clinic_code', req.params.code.toUpperCase())
    .single();

  if (error || !data) return res.status(404).json({ error: 'Clinic not found. Check the link.' });
  res.json({ clinic: data });
});

// GET /public/slots/:doctorId?date=YYYY-MM-DD — available slots (no auth)
router.get('/slots/:doctorId', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const { data: doctor } = await supabase
    .from('doctors')
    .select('working_hours, slot_duration_minutes')
    .eq('id', req.params.doctorId)
    .single();

  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const { data: booked } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('doctor_id', req.params.doctorId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled');

  const bookedTimes = (booked || []).map(a => a.appointment_time);
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const dayName = days[new Date(date).getDay()];
  const hours = doctor.working_hours?.[dayName];

  if (!hours || hours === 'closed') {
    return res.json({ slots: [], message: 'Clinic is closed on this day' });
  }

  const [start, end] = hours.split('-');
  const slots = [];
  let current = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const duration = doctor.slot_duration_minutes || 15;

  while (current + duration <= endMinutes) {
    const timeStr = minutesToTime(current);
    slots.push({ time: timeStr, available: !bookedTimes.includes(timeStr + ':00') });
    current += duration;
  }

  res.json({ slots, slot_duration: duration });
});

// POST /public/book — book appointment as patient (no auth)
router.post('/book', async (req, res) => {
  const { doctor_id, appointment_date, appointment_time, patient_name, patient_age, patient_phone, patient_gender, problem } = req.body;

  if (!doctor_id || !appointment_date || !appointment_time || !patient_name || !patient_phone) {
    return res.status(400).json({ error: 'Name, phone, date and time are required' });
  }

  // Check slot not already taken
  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctor_id)
    .eq('appointment_date', appointment_date)
    .eq('appointment_time', appointment_time)
    .neq('status', 'cancelled');

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'This slot was just taken. Please pick another time.' });
  }

  // Find or create patient record
  let patient_id;
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('doctor_id', doctor_id)
    .eq('phone', patient_phone)
    .single();

  if (existingPatient) {
    patient_id = existingPatient.id;
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from('patients')
      .insert({
        doctor_id,
        name: patient_name,
        age: patient_age || null,
        phone: patient_phone,
        gender: patient_gender || null,
      })
      .select()
      .single();

    if (patientError) return res.status(400).json({ error: patientError.message });
    patient_id = newPatient.id;
  }

  // Book appointment
  const { data: appointment, error: aptError } = await supabase
    .from('appointments')
    .insert({
      doctor_id,
      patient_id,
      appointment_date,
      appointment_time,
      problem,
      status: 'scheduled'
    })
    .select()
    .single();

  if (aptError) return res.status(400).json({ error: aptError.message });

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully!',
    appointment: {
      id: appointment.id,
      date: appointment_date,
      time: appointment_time,
      patient_name,
      problem
    }
  });
});

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = router;
