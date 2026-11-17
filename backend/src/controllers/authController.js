'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { Colaborador, SaldoVacaciones } = require('../models');

const loginSchema = z.object({
  email: z.string().email('Formato de correo electrónico inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.')
});

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Datos de acceso inválidos.'
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const colaborador = await Colaborador.findOne({
      where: { email, estado: 'activo' }
    });

    if (!colaborador) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas o usuario inactivo.'
      });
    }

    const validPassword = await bcrypt.compare(password, colaborador.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas o usuario inactivo.'
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no está configurado en el servidor.');
    }

    const payload = {
      id: colaborador.id,
      email: colaborador.email,
      nombre: colaborador.nombre,
      departamento: colaborador.departamento,
      rol: colaborador.rol
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: colaborador.id,
        nombre: colaborador.nombre,
        email: colaborador.email,
        departamento: colaborador.departamento,
        puesto: colaborador.puesto,
        fecha_ingreso: colaborador.fecha_ingreso,
        rol: colaborador.rol,
        estado: colaborador.estado
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const colaborador = await Colaborador.findByPk(req.user.id, {
      attributes: [
        'id',
        'nombre',
        'email',
        'departamento',
        'puesto',
        'fecha_ingreso',
        'jefe_id',
        'rol',
        'estado'
      ],
      include: [
        {
          model: Colaborador,
          as: 'jefe',
          attributes: ['id', 'nombre', 'email', 'puesto']
        },
        {
          model: SaldoVacaciones,
          as: 'saldosVacaciones',
          order: [['periodo', 'DESC']],
          limit: 1
        }
      ]
    });

    if (!colaborador) {
      return res.status(404).json({
        ok: false,
        error: 'Colaborador no encontrado.'
      });
    }

    const saldoActual = colaborador.saldosVacaciones?.[0] || null;
    const userData = colaborador.toJSON();
    delete userData.saldosVacaciones;

    return res.status(200).json({
      ok: true,
      user: userData,
      saldo_vacaciones: saldoActual
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  login,
  me
};

