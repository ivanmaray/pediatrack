#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const ProtocolCycleSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  titulo: z.string().min(1),
  descripcion: z.string().optional(),
  duracion_dias: z.number().int().positive().optional(),
  when: z.union([z.string(), z.object({})]).optional(),
  drogas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        dosis: z.string().min(1).optional(),
        dias: z.array(z.number().int().positive()).optional(),
      })
    )
    .optional(),
});

const QuimioSchema = z.object({
  // Acepta array o null/undefined para tolerar datos incompletos
  induccion: z.array(ProtocolCycleSchema).nullable().optional(),
  consolidacion: z.array(ProtocolCycleSchema).nullable().optional(),
  mantenimiento: z.any().nullable().optional(),
  reinduccion: z.array(ProtocolCycleSchema).nullable().optional(),
}).partial();

const VersionSchema = z.object({
  id: z.string().min(1).optional(),
  titulo: z.string().optional(),
  evaluacion: z.array(z.any()).optional(),
  cirugia: z.any().optional(),
  radioterapia: z.any().optional(),
  quimioterapia: QuimioSchema.optional(),
  inmunoterapia: z.any().optional(),
  trasplante: z.any().optional(),
  profilaxis: z.any().optional(),
  seguimiento: z.any().optional(),
});

const ProtocolSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().optional(),
  nombre: z.string().optional(),
  grupo: z.string().optional(),
  area: z.string().optional(),
  versiones: z.array(VersionSchema).optional(),
  quimioterapia: QuimioSchema.optional(),
});

// Índice (listado de protocolos disponibles)
const IndexSchema = z.array(
  z.object({
    id: z.string().min(1),
    nombre: z.string().optional(),
    grupo: z.string().optional(),
    titulo: z.string().optional(),
    area: z.string().optional(),
  })
);

const dataDir = path.join(process.cwd(), 'data');
const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

let hadErrors = false;

for (const f of files) {
  const full = path.join(dataDir, f);
  try {
    const text = fs.readFileSync(full, 'utf8');
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      // Validar índice si aplica, en otros arrays solo avisar
      if (f.toLowerCase() === 'index.json') {
        const ir = IndexSchema.safeParse(json);
        if (!ir.success) {
          hadErrors = true;
          console.error(`\n❌ ${f} (índice) no cumple el esquema:`);
          ir.error.issues.forEach((iss) => {
            console.error(`  - ${iss.path.join('.')}: ${iss.message}`);
          });
        } else {
          console.log(`✅ ${f} (índice) válido`);
        }
      } else {
        console.warn(`⚠️ ${f} es un array y se omite de la validación de protocolos.`);
      }
      continue;
    }

    const res = ProtocolSchema.safeParse(json);
    if (!res.success) {
      hadErrors = true;
      console.error(`\n❌ ${f} no cumple el esquema:`);
      res.error.issues.forEach((iss) => {
        console.error(`  - ${iss.path.join('.')}: ${iss.message}`);
      });
    } else {
      console.log(`✅ ${f} válido`);
    }
  } catch (e) {
    hadErrors = true;
    console.error(`\n❌ ${f} inválido: ${e.message}`);
  }
}

if (hadErrors) {
  console.error('\nFallo de validación de protocolos. Corrige los errores anteriores.');
  process.exit(1);
} else {
  console.log('\nTodos los protocolos válidos.');
}
