# Informe de Investigación Laboral y Diseño de Base de Conocimiento para RAG Multiagente

| Metadato | Detalle |
| :--- | :--- |
| **Documento** | Informe Técnico de Investigación Laboral y Arquitectura Documental RRHH |
| **Código / Versión** | `DOC-GUIA-RRHH-01 · v1.0` |
| **Empresa Modelo** | NovaCore Technologies Costa Rica S.A. |
| **Sector / Dotación** | Desarrollo de software y servicios tecnológicos B2B · 250 colaboradores |
| **Marco Jurídico Base** | República de Costa Rica (Código de Trabajo Ley N.° 2 y normativa conexa) |
| **Fecha de Emisión** | 01 de enero de 2026 |
| **Responsable** | Dirección de Talento Humano y Arquitectura de Datos RAG - NovaCore CR |

---

## 1. Resumen Ejecutivo

El presente informe documenta la investigación operativa, jurídica y de arquitectura de datos realizada para sustentar el **Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente** de **NovaCore Technologies Costa Rica S.A.** La organización cuenta con **250 colaboradores** distribuidos en seis áreas funcionales: **Ingeniería, Producto, Operaciones, Ventas, Finanzas y Talento Humano**, operando bajo el régimen laboral de la República de Costa Rica.

En empresas tecnológicas de mediano tamaño y crecimiento sostenido, el volumen de consultas repetitivas hacia Talento Humano (cálculo de vacaciones, feriados, boletas de incapacidad, límites de teletrabajo, fechas de planilla, aguinaldo, cobertura de seguro privado, preaviso y liquidación) genera cuellos de botella operativos y riesgo de inconsistencias en las respuestas. Para resolverlo, el proyecto adopta una arquitectura de **Generación Aumentada por Recuperación (RAG)** combinada con **orquestación multiagente**, donde la fuente única de verdad reside en diez documentos normativos oficiales alojados en Google Drive e indexados en una base vectorial.

Desde el punto de vista normativo, toda respuesta emitida por el sistema debe distinguir con precisión absoluta entre:
1. **El mínimo obligatorio establecido por la legislación costarricense** (Código de Trabajo, leyes especiales y reglamentos de la CCSS e INS).
2. **Las mejoras y beneficios corporativos otorgados voluntariamente por NovaCore** (como 15 días hábiles de vacaciones anuales, complemento salarial en incapacidades, seguro médico colectivo y aporte solidarista).

---

## 2. Operación del Departamento Interno de Talento Humano

### 2.1 Estructura Funcional de Talento Humano

Para atender a 250 colaboradores en un entorno híbrido B2B de tecnología, el departamento de Talento Humano de NovaCore se estructura en cuatro subáreas interdependientes:

1. **Administración de Personal y Nómina (People Operations & Payroll):** Gestiona contratos, altas y bajas ante la Caja Costarricense de Seguro Social (CCSS) y el Instituto Nacional de Seguros (INS), control de asistencia y marcas, cálculo de planillas quincenales, retenciones fiscales, aguinaldo, incapacidades, vacaciones y liquidaciones laborales.
2. **Adquisición de Talento y Onboarding:** Lidera el reclutamiento técnico y comercial, la verificación de referencias, la inducción de primera semana y el seguimiento del periodo de prueba de 90 días.
3. **Desarrollo Organizacional, Desempeño y Bienestar:** Coordina los ciclos semestrales de evaluación de desempeño (junio y diciembre), planes de mejora (PIP), rutas de promoción interna, presupuesto de capacitación y administración de beneficios (seguro médico colectivo y coordinación con la Asociación Solidarista).
4. **Cumplimiento Laboral, Ética y Privacidad:** Vela por la aplicación del Reglamento Interno, la instrucción de procesos disciplinarios graduales, la prevención del acoso laboral y hostigamiento sexual, el resguardo confidencial de expedientes y el cumplimiento de la Ley N.° 8968 de protección de datos.

### 2.2 Ciclo de Vida del Colaborador y Puntos Críticos de Consulta

Cada etapa del ciclo de vida laboral genera demandas de información específicas que el sistema multiagente debe resolver con trazabilidad documental:

- **Ingreso e Integración (Pre-boarding y Onboarding):** Entrega de equipo, firma de contrato con periodo de prueba de 3 meses, firma del acuerdo de teletrabajo y lectura de políticas base.
- **Operación Cotidiana:** Registro de jornada (diurna, mixta o nocturna), programación de hasta 3 días semanales de teletrabajo, autorización de horas extra y solicitud de vacaciones con 10 días hábiles de anticipación.
- **Contingencias y Licencias:** Trámite de incapacidades CCSS/INS dentro de las 24 a 48 horas posteriores a la emisión, solicitud de licencias por matrimonio, fallecimiento, maternidad o paternidad.
- **Compensación y Desarrollo:** Comprensión de colillas de pago quincenales, deducciones legales, cálculo del aguinaldo, evaluaciones semestrales y aprovechamiento del seguro médico o bono de capacitación.
- **Egreso:** Cómputo de preaviso en renuncias voluntarias y desglose de liquidación ante despidos con o sin responsabilidad patronal.

### 2.3 Principios de Trazabilidad para el Sistema RAG

Para evitar alucinaciones o respuestas ambiguas en materia laboral, la base documental sigue reglas estrictas de ingeniería de conocimiento:
- **Metadatos normalizados en cabecera:** Todos los documentos incluyen Título, Código/Versión, Fecha de vigencia y Responsable, permitiendo que los agentes citen la fuente exacta en cada respuesta.
- **Segmentación semántica (*Chunking*):** Los documentos utilizan encabezados `##` y `###` autónomos y tablas estructuradas diseñadas para fragmentos de entre **500 y 1000 tokens**, evitando que una regla de cálculo quede separada de sus condiciones de aplicación.
- **Frontera negativa explícita (Prevención de invención):** Lo que no está regulado o no existe como beneficio corporativo (por ejemplo, subsidios o bonos inexistentes en el catálogo oficial) se omite deliberadamente para que el agente evaluador responda que no existe cobertura registrada.

---

## 3. Análisis del Marco Legal Aplicable en Costa Rica por Dominio

### 3.1 Vacaciones y Días Feriados (Dominio 01)

El **Capítulo III del Título Tercero del Código de Trabajo (artículos 153 a 161)** regula el descanso anual remunerado. El artículo 153 establece que todo trabajador tiene derecho a vacaciones anuales remuneradas cuyo mínimo se fija en **dos semanas por cada cincuenta semanas de labores continuas** al servicio de un mismo patrono (equivalente práctico a 12 días hábiles en jornadas de seis días, o 10 días hábiles de descanso efectivo en esquemas semanales de cinco días cuando se prorratea por semanas de trabajo, aunque tradicionalmente se referencia el mínimo de 12 días hábiles tras 50 semanas). El artículo 156 prohíbe compensar las vacaciones en dinero mientras la relación laboral esté vigente, salvo excepciones taxativas (como la terminación del contrato), y el artículo 159 restringe la acumulación de periodos, permitiéndola únicamente por una sola vez en labores técnicas, de dirección o confianza cuando sea difícil reemplazar al trabajador.

En materia de feriados, los **artículos 147, 148 y 149 del Código de Trabajo** distinguen entre **feriados de pago obligatorio** (9 fechas al año: 1 de enero, 11 de abril, Jueves Santo, Viernes Santo, 1 de mayo, 25 de julio, 15 de agosto, 15 de setiembre y 25 de diciembre) y **feriados de pago no obligatorio** (3 fechas: 2 de agosto, 31 de agosto y 1 de diciembre, tras las reformas de las Leyes N.° 9803 y N.° 10050). El 12 de octubre conserva carácter de conmemoración cívica y educativa sin ser día feriado de descanso laboral. Para empresas con modalidad de pago quincenal o mensual como NovaCore, todos los feriados se entienden remunerados dentro del salario ordinario cuando se disfrutan; si se laboran por necesidad operativa, corresponde el pago adicional de un salario sencillo para completar el pago doble (Art. 149 CT).

### 3.2 Permisos y Licencias Laborales (Dominio 02)

El Código de Trabajo costarricense contempla licencias obligatorias de protección familiar y social, complementadas por reformas recientes:
- **Licencia por Maternidad (Artículos 94, 95, 96 y 97 CT):** Toda trabajadora en estado de gravidez goza obligatoriamente de una licencia remunerada de **cuatro meses** (un mes antes del parto y tres meses después). Durante este periodo, el subsidio es cubierto en un **50 % por la CCSS y un 50 % por el patrono**, garantizando el 100 % del ingreso (Art. 95 CT). Además, el artículo 97 garantiza el periodo de lactancia materna remunerado al reincorporarse.
- **Licencia por Paternidad y Cuidados Especiales (Ley N.° 10211, reforma al artículo 95 CT):** Otorga a los padres biológicos en el sector privado una licencia de **ocho días hábiles** con goce de salario (distribuidos a razón de dos días por semana durante las primeras cuatro semanas posteriores al nacimiento), cuya carga económica se comparte entre CCSS y patrono conforme al régimen legal. Asimismo, regula licencias especiales en casos de adopción o fallecimiento de la madre durante el parto o posparto.
- **Permisos por Fallecimiento, Matrimonio, Estudio y Licencias sin Goce:** El Código de Trabajo no impone un número fijo general de días con goce de salario por duelo familiar o matrimonio en el sector privado (salvo convenciones o reglamentos internos), por lo que las políticas de NovaCore (5 días por fallecimiento de 1.er grado, 2 días por 2.do grado y 3 días por matrimonio) constituyen mejoras corporativas vinculantes una vez promulgadas. Las licencias sin goce de salario suspenden temporalmente la prestación de servicios y el pago salarial (Art. 73 y ss. CT por analogía contractual y mutuo acuerdo), manteniendo intacta la antigüedad acumulada antes de la suspensión.

### 3.3 Incapacidades por Enfermedad Común y Riesgos del Trabajo (Dominio 03)

El régimen de seguridad social costarricense distingue dos sistemas de cobertura:
1. **Enfermedad Común y Maternidad (Reglamento del Seguro de Salud de la CCSS):** Para incapacidades emitidas por la CCSS (o médicos autorizados validados ante la Caja), durante los **primeros tres días** de incapacidad la CCSS no paga subsidio; el patrono debe cubrir por regla general el **50 % del salario** durante esos días 1 a 3. A partir del **cuarto día**, la CCSS asume un subsidio equivalente al **60 % del salario promedio** reportado. NovaCore mejora sustancialmente esta base legal complementando hasta alcanzar el **100 % del salario** en los días 1 a 3 (+50 % patronal) y otorgando un **40 % de complemento** del día 4 al día 30 (+60 % CCSS = 100 %).
2. **Riesgos del Trabajo (Título IV del Código de Trabajo, artículos 193 y siguientes, administrado por el INS):** Todo patrono está obligado a asegurar a sus colaboradores contra accidentes y enfermedades laborales mediante la póliza de Riesgos del Trabajo del Instituto Nacional de Seguros. A diferencia de la enfermedad común, el INS cubre la incapacidad **desde el primer día** posterior al accidente (o desde el día del evento según corresponda), con subsidios tarifados por ley (60 % del salario diario durante los primeros 45 días sobre el exceso del salario mínimo legal y 100 % hasta el salario mínimo, y reglas de incapacidad temporal/permanente según el Art. 236 CT).

### 3.4 Jornada Laboral, Teletrabajo y Horas Extraordinarias (Dominio 04)

Los **artículos 135 a 146 del Código de Trabajo** regulan las jornadas ordinarias máximas:
- **Jornada Diurna (5:00 a.m. a 7:00 p.m.):** Máximo **8 horas diarias y 48 horas semanales** (Art. 136 CT). En labores no peligrosas ni insalubres puede ampliarse hasta 10 horas diarias sin exceder las 48 semanales (jornada acumulativa de lunes a viernes).
- **Jornada Mixta:** Incluye horas diurnas y nocturnas, siempre que las nocturnas no alcancen 3 horas y media. Máximo **7 horas diarias y 42 horas semanales** (Art. 136 y 138 CT). Si supera 3.5 horas nocturnas se reputa nocturna.
- **Jornada Nocturna (7:00 p.m. a 5:00 a.m.):** Máximo **6 horas diarias y 36 horas semanales** (Art. 136 CT).

En cuanto a trabajo extraordinario, el **artículo 139 CT** dispone que el trabajo efectivo fuera de los límites ordinarios constituye jornada extraordinaria y debe remunerarse con un **50 % adicional** sobre el salario de la hora ordinaria (tiempo y medio). Si se labora en día de descanso semanal obligatorio (Art. 152 CT) o en día feriado de pago obligatorio (Art. 149 CT), la remuneración corresponde al **pago doble (+100 %)**.

El **teletrabajo** está regulado por la **Ley para Regular el Teletrabajo (Ley N.° 9738)** y su Reglamento (Decreto Ejecutivo N.° 42083-MP-MTSS-MIDEPLAN-MICITT), que exigen voluntariedad mediante adenda o contrato escrito, igualdad de derechos y remuneración, dotación o acuerdo sobre herramientas, prevención de riesgos laborales y derecho a la desconexión digital. NovaCore adopta un modelo híbrido de hasta **3 días de teletrabajo semanal**.

### 3.5 Salarios, Deducciones Legales y Aguinaldo (Dominio 05)

Según los **artículos 162 a 176 del Código de Trabajo**, el salario debe pagarse en moneda de curso legal con periodicidad no mayor a la quincena para trabajadores manuales o mensual para intelectuales/administrativos. NovaCore estandariza el pago **quincenal** (día 15 y último día hábil de cada mes) para toda su planilla.

Las deducciones obligatorias sobre el salario bruto comprenden:
- **Cargas Obreras de Seguridad Social (CCSS):** Contribución para el Seguro de Enfermedad y Maternidad (SEM) y el régimen de Invalidez, Vejez y Muerte (IVM). En el parámetro base de planilla de NovaCore se refleja la tasa histórica de referencia del **10.67 %** junto con el **1 % de aporte obrero al Banco Popular** (Ley Orgánica del Banco Popular y Ley de Protección al Trabajador N.° 7983), además del **Impuesto sobre la Renta al Salario** (Art. 32 y 33 de la Ley del Impuesto sobre la Renta N.° 7092), aplicado progresivamente según los tramos vigentes fijados anualmente por el Ministerio de Hacienda. *(Nota de cumplimiento: ante ajustes graduales reglamentarios del IVM de la CCSS a partir de 2026, Planilla parametriza el desglose oficial vigente en las colillas fiscales manteniendo la trazabilidad contable).*
- **Aguinaldo (Ley de Aguinaldo en la Empresa Privada, Ley N.° 2412):** Todo patrono debe pagar un sueldo adicional dentro de los **primeros veinte días del mes de diciembre**. NovaCore realiza el desembolso fijo el **15 de diciembre**. La fórmula legal es la suma de todos los salarios ordinarios y extraordinarios devengados por el trabajador entre el **1 de diciembre del año anterior y el 30 de noviembre del año vigente, dividida entre doce**. El aguinaldo está exento de deducciones de CCSS e Impuesto sobre la Renta (salvo pensión alimentaria por orden judicial).

### 3.6 Beneficios Corporativos y Solidarismo (Dominio 06)

Más allá del piso legal, el sector tecnológico en Costa Rica compite mediante compensación total:
- **Asociación Solidarista (Ley de Asociaciones Solidaristas N.° 6970):** La entidad **ASONOVACORE** opera con ahorro voluntario del colaborador (**5 %**) y aporte patronal mensual del **5.33 %**, el cual se registra y acredita como adelanto/reserva de auxilio de cesantía conforme a la ley. Cuando el colaborador se desvincula (incluso por renuncia), conserva la totalidad de su ahorro personal más el aporte patronal acumulado según los estatutos y la ley.
- **Seguro Médico Privado Colectivo y Bono de Capacitación:** Son beneficios extralegales diseñados por NovaCore (80 % consulta externa/medicamentos, 90 % hospitalización, dental/óptico básico y presupuesto anual de formación), sujetos a elegibilidad y permanencia activa.

### 3.7 Onboarding, Periodo de Prueba, Preaviso y Liquidación (Dominio 07)

El **artículo 28 del Código de Trabajo** establece que en los contratos por tiempo indefinido cualquiera de las partes puede dar por terminada la relación sin justa causa dentro de los primeros **tres meses (periodo de prueba)** sin responsabilidad de preaviso ni cesantía. Superado ese plazo, quien dé por terminado el contrato sin justa causa debe otorgar **preaviso** con la siguiente escala legal:
- Menos de 3 meses de servicio continuo: **0 días**.
- De 3 meses a menos de 6 meses: **1 semana** (7 días).
- De 6 meses a menos de 1 año: **15 días**.
- Después de 1 año de servicio continuo: **1 mes** (30 días).

Durante el preaviso, el trabajador tiene derecho a **un día semanal con goce de salario** para buscar nueva colocación (Art. 28 CT).

Si ocurre un **despido sin justa causa (con responsabilidad patronal)**, el **artículo 29 del Código de Trabajo** (reformado por la Ley de Protección al Trabajador N.° 7983) obliga al pago de **auxilio de cesantía** calculado sobre el promedio salarial de los últimos seis meses, con un **tope máximo de 8 años**, conforme a la escala gradual (7 días entre 3 y 6 meses; 14 días entre 6 meses y 1 año; y de 19.5 a 22 días por año laborado o fracción superior a 6 meses a partir del año 1). Además, toda liquidación incluye **vacaciones proporcionales** y **aguinaldo proporcional** (independientemente de la causal de salida).

### 3.8 Evaluación del Desempeño y Desarrollo (Dominio 08)

El ordenamiento jurídico costarricense reconoce la potestad de dirección y organización del patrono (Art. 18 y 71 CT), siempre que las evaluaciones sean objetivas, no discriminatorias (Art. 404 y ss. CT tras la Reforma Procesal Laboral, Ley N.° 9343) y respeten el debido proceso cuando se implementan Planes de Mejora del Desempeño (PIP) previos a eventuales medidas administrativas.

### 3.9 Ética, Prevención de Acoso y Denuncias (Dominio 09)

El marco disciplinario y ético de NovaCore se apoya en:
- **Ley contra el Hostigamiento o Acoso Sexual en el Empleo y la Docencia (Ley N.° 7476 y su reforma Ley N.° 8805):** Obliga al patrono a mantener una política interna clara, divulgarla, establecer un procedimiento interno confidencial y ágil de denuncia e investigación, conformar comisiones instructoras imparciales y garantizar la prohibición absoluta de represalias contra denunciantes y testigos.
- **Prevención del Acoso Laboral (*Mobbing*) y No Discriminación:** Deber patronal de tutelar la dignidad e integridad psicosocial en el trabajo (Art. 19, 69 y Título VIII del Código de Trabajo sobre prohibición de discriminación).
- **Régimen Disciplinario y Causales de Despido (Art. 81 CT):** Aplicación de proporcionalidad, gradualidad (salvo faltas graves taxativas del Art. 81 CT) y debido proceso documentado.

### 3.10 Protección de Datos Personales de Colaboradores (Dominio 10)

La **Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley N.° 8968)** y su Reglamento (Decreto Ejecutivo N.° 37554-JP) imponen principios de consentimiento informado, calidad de la información, seguridad y confidencialidad. El expediente laboral contiene datos personales de acceso irrestricto para administración contractual, datos de acceso restringido (salarios, evaluaciones, cuentas bancarias) y **datos sensibles** (diagnósticos médicos, incapacidades, afiliación sindical/solidarista, investigaciones de acoso), cuyo tratamiento exige medidas técnicas de resguardo y garantía efectiva de los **derechos ARCO** (Acceso, Rectificación, Cancelación y Oposición) ante el responsable interno de datos.

---

## 4. Tabla Comparativa: Mínimo Legal (Costa Rica) vs. Mejoras Corporativas NovaCore

| Dominio | Mínimo Legal (Código de Trabajo / Leyes CR) | Política Interna NovaCore Technologies CR | Diferencial / Mejora |
| :--- | :--- | :--- | :--- |
| **Vacaciones anuales** | 2 semanas tras 50 semanas continuas (~12 días hábiles base legal, Art. 153 CT). | **15 días hábiles** por cada 50 semanas laboradas; tope de acumulación de **20 días hábiles** con alerta y plan de disfrute. | **+3 días hábiles** anuales adicionales sobre la base tradicional. |
| **Feriados** | 9 feriados de pago obligatorio y 3 de pago no obligatorio (Art. 148 CT). | Se respetan los 12 feriados de ley; con salario quincenal ninguno sufre rebajo y si se labora se paga doble. | Cumplimiento integral y planificación anticipada en Q4. |
| **Licencia por fallecimiento** | No existe licencia remunerada obligatoria fija en Código de Trabajo para sector privado. | **5 días hábiles** (1.er grado) y **2 días hábiles** (2.do grado) con goce de 100 % de salario. | **Beneficio corporativo 100 % adicional** al mínimo legal. |
| **Licencia por matrimonio** | No existe licencia remunerada obligatoria en Código de Trabajo. | **3 días hábiles** con goce de salario. | **Beneficio corporativo 100 % adicional.** |
| **Maternidad y paternidad** | Maternidad: 4 meses (1 pre + 3 posparto, Art. 95 CT). Paternidad: 8 días hábiles en primeras 4 semanas (Ley N.° 10211). | Maternidad: 4 meses (50 % CCSS + 50 % empresa). Paternidad: 8 días hábiles en primeras 4 semanas según ley. | Cumplimiento estricto con acompañamiento administrativo de RRHH. |
| **Incapacidad enfermedad (días 1-3)** | Patrono cubre el **50 %** del salario; CCSS no subsidia (Reglamento CCSS). | **50 % patronal + 50 % complemento empresa = 100 % del salario**. | **+50 % de complemento** para evitar pérdida salarial. |
| **Incapacidad enfermedad (día 4+)** | CCSS subsidia **60 %** del salario desde el día 4; patrono no está obligado a complementar. | **60 % CCSS + 40 % complemento empresa hasta el día 30**. | **+40 % de complemento** hasta el día 30 de incapacidad. |
| **Riesgos del trabajo** | Cobertura INS obligatoria desde el día 1 (Art. 193 y ss. CT). | Reporte inmediato, cobertura INS desde día 1 y soporte en gestión de boletas (24–48h). | Cumplimiento integral y gestión asistida. |
| **Modalidad y teletrabajo** | Teletrabajo voluntario y regulado (Ley N.° 9738), sin mínimo fijo de días remotos. | Esquema híbrido de hasta **3 días de teletrabajo por semana**. | Flexibilidad híbrida estructurada. |
| **Jornada y horas extra** | 8h/48h diurna, 7h/42h mixta, 6h/36h nocturna; extras +50 %; feriado/descanso +100 %. | Cumplimiento exacto de topes legales y recargos (+50 % ordinaria; +100 % feriados/descanso). | Cumplimiento estricto + flexibilidad horaria por bandas. |
| **Pagos y aguinaldo** | Pago al menos quincenal/mensual; aguinaldo en primeros 20 días de diciembre (Ley N.° 2412). | Pagos fijos días **15 y último día hábil**; aguinaldo pagado el **15 de diciembre**. | Previsibilidad anticipada de pago navideño. |
| **Beneficios y solidarismo** | No son obligatorios por ley el seguro médico privado, solidarismo ni bono educativo. | **Seguro médico privado** (80 % / 90 % + dental/óptico), **Asociación Solidarista** (5.33 % patronal + 5 % ahorro) y **bono anual de capacitación**. | Paquete integral de compensación no salarial. |
| **Prueba, preaviso y liquidación** | Prueba 90 días; preaviso escalonado (0, 7, 15, 30 días); cesantía Art. 29 CT tope 8 años. | Aplicación íntegra de Art. 28 y 29 CT + onboarding estructurado de primera semana. | Cumplimiento estricto y transparencia de cálculo. |

---

## 5. Arquitectura de Datos para RAG y Distribución de Formatos en Google Drive

Los 10 documentos alojados en `docs/knowledge-base/` están redactados en Markdown limpio como fuente maestra versionada en Git y se exportarán hacia la carpeta monitoreada de Google Drive del sistema RAG utilizando los formatos nativos más adecuados según la naturaleza de cada archivo:

| Archivo Base (Markdown) | Formato Destino en Google Drive | Justificación Técnica para Ingesta RAG |
| :--- | :--- | :--- |
| `01_politica_vacaciones_feriados.md` | **PDF** | Política formal estable con tabla oficial de feriados y reglas de pasivo laboral; requiere inmutabilidad de formato. |
| `02_politica_permisos_licencias.md` | **Google Docs** | Política normativa viva de consulta frecuente; fácil actualización ante reformas legales desde Drive API. |
| `03_procedimiento_incapacidades.md` | **PDF** | Procedimiento operativo paso a paso con porcentajes críticos de CCSS/INS y plazos de 24–48h. |
| `04_reglamento_jornada_teletrabajo.md` | **PDF** | Reglamento interno vinculante sobre jornadas, recargos de horas extra y teletrabajo híbrido. |
| `05_politica_salarial_pagos.md` | **Google Docs** | Documento sujeto a actualización anual de tramos del Impuesto sobre la Renta y parámetros de planilla. |
| `06_catalogo_beneficios.md` | **Google Sheets** | Catálogo tabular estructurado de coberturas, porcentajes solidaristas y montos de capacitación (ideal para extracción estructurada por filas). |
| `07_manual_onboarding_salida.md` | **PDF** | Manual formal de ciclo de entrada/salida con tablas legales de preaviso y cesantía (Art. 28 y 29 CT). |
| `08_politica_evaluacion_desempeno.md` | **Google Docs** | Lineamiento de gestión del talento con ciclos semestrales y formatos de PIP revisables por periodo. |
| `09_codigo_conducta_denuncias.md` | **PDF** | Documento institucional de cumplimiento ético, Ley N.° 7476 y régimen disciplinario con validez probatoria. |
| `10_aviso_privacidad_colaboradores.md` | **PDF** | Aviso legal oficial conforme a la Ley N.° 8968 y derechos ARCO que requiere versión sellada y fechada. |

---

## 6. Fuentes Consultadas

1. **Código de Trabajo de la República de Costa Rica (Ley N.° 2 del 27 de agosto de 1943 y sus reformas):**
   - Artículos 18, 19, 28 y 29 (contrato de trabajo, periodo de prueba, preaviso y escala de auxilio de cesantía con tope de 8 años).
   - Artículos 69, 71, 73 y 81 (obligaciones patronales/trabajadores, suspensión del contrato y causales de despido sin responsabilidad patronal).
   - Artículos 94, 95, 96 y 97 (protección a la maternidad, licencia pre y posparto, subsidios y periodo de lactancia).
   - Artículos 135 a 146 (jornadas diurna, mixta y nocturna, descansos y jornada extraordinaria).
   - Artículos 147, 148, 149 y 152 (días feriados de pago obligatorio y no obligatorio, día de descanso semanal y recargos).
   - Artículos 153 a 161 (vacaciones anuales remuneradas, prohibición de compensación y reglas de acumulación).
   - Artículos 162 a 176 (salario, plazos de pago y protección salarial).
   - Artículos 193 y siguientes, Título IV (Riesgos del Trabajo e Instituto Nacional de Seguros).
   - Artículo 404 y siguientes, Título VIII (prohibición de discriminación laboral, Reforma Procesal Laboral Ley N.° 9343).
2. **Ley de Protección al Trabajador (Ley N.° 7983 del 16 de febrero de 2000):** Reforma al auxilio de cesantía (Art. 29 CT), Fondo de Capitalización Laboral y aporte obrero al Banco Popular.
3. **Ley para Combatir la Discriminación Laboral contra las Mujeres en Condición de Maternidad / Licencia de Paternidad (Ley N.° 10211 del 5 de mayo de 2022):** Reforma al artículo 95 del Código de Trabajo incorporando licencia de paternidad de 8 días hábiles en las primeras 4 semanas, adopción y licencias especiales.
4. **Ley contra el Hostigamiento o Acoso Sexual en el Empleo y la Docencia (Ley N.° 7476 del 3 de febrero de 1995 y su reforma mediante Ley N.° 8805):** Deber de prevención, procedimiento confidencial de denuncia, garantías de no represalia y sanciones.
5. **Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley N.° 8968 del 7 de julio de 2011) y su Reglamento (Decreto Ejecutivo N.° 37554-JP):** Principios de consentimiento informado, confidencialidad, categorías de datos sensibles y derechos ARCO.
6. **Ley para Regular el Teletrabajo (Ley N.° 9738 del 18 de setiembre de 2019) y su Reglamento (Decreto Ejecutivo N.° 42083):** Voluntariedad, igualdad laboral, herramientas y desconexión digital.
7. **Ley de Pago de Aguinaldo en la Empresa Privada (Ley N.° 2412 del 23 de octubre de 1959 y reformas):** Plazo de pago en los primeros 20 días de diciembre y fórmula de cálculo sobre doceavos.
8. **Ley de Asociaciones Solidaristas (Ley N.° 6970 del 7 de noviembre de 1984):** Regulación de aportes patronales como reserva/adelanto de cesantía y ahorro obrero.
9. **Ley del Impuesto sobre la Renta (Ley N.° 7092, artículos 32 y 33) y Decretos de Tramos Salariales del Ministerio de Hacienda:** Retención mensual/quincenal progresiva aplicable al trabajo personal dependiente.
10. **Reglamento del Seguro de Salud de la Caja Costarricense de Seguro Social (CCSS) y Normativa del Instituto Nacional de Seguros (INS):** Reglas de subsidios por enfermedad común (días 1–3 patrono al 50 %, día 4+ CCSS al 60 %) y cobertura de riesgos del trabajo desde el día 1.
11. **Guías Técnicas y Criterios Jurídicos del Ministerio de Trabajo y Seguridad Social (MTSS) de Costa Rica:** Guías oficiales sobre cálculo de aguinaldo, liquidaciones laborales, feriados, vacaciones y prevención del hostigamiento laboral.

