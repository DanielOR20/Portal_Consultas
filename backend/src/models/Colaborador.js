'use strict';

module.exports = (sequelize, DataTypes) => {
  const Colaborador = sequelize.define(
    'Colaborador',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      departamento: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      puesto: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      fecha_ingreso: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      jefe_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      rol: {
        type: DataTypes.ENUM('colaborador', 'rrhh'),
        allowNull: false,
        defaultValue: 'colaborador'
      },
      estado: {
        type: DataTypes.ENUM('activo', 'inactivo'),
        allowNull: false,
        defaultValue: 'activo'
      }
    },
    {
      tableName: 'colaboradores',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true
    }
  );

  Colaborador.associate = (models) => {
    Colaborador.belongsTo(models.Colaborador, {
      as: 'jefe',
      foreignKey: 'jefe_id'
    });
    Colaborador.hasMany(models.Colaborador, {
      as: 'subordinados',
      foreignKey: 'jefe_id'
    });
    Colaborador.hasMany(models.SaldoVacaciones, {
      as: 'saldosVacaciones',
      foreignKey: 'colaborador_id'
    });
    Colaborador.hasMany(models.Solicitud, {
      as: 'solicitudes',
      foreignKey: 'colaborador_id'
    });
    Colaborador.hasMany(models.Solicitud, {
      as: 'solicitudesAprobadas',
      foreignKey: 'aprobador_id'
    });
    Colaborador.hasMany(models.Incapacidad, {
      as: 'incapacidades',
      foreignKey: 'colaborador_id'
    });
    Colaborador.hasMany(models.MovimientoPersonal, {
      as: 'movimientos',
      foreignKey: 'colaborador_id'
    });
    Colaborador.hasMany(models.ConsultaChat, {
      as: 'consultasChat',
      foreignKey: 'colaborador_id'
    });
  };

  return Colaborador;
};

