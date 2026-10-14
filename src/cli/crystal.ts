import { switchCrystal } from '../runtime/crystal.js';
switchCrystal(process.argv[2] ?? '', process.argv[3], process.argv[4]);
