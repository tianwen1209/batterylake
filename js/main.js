/* ══════════════════════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════════════════════ */
const GITHUB_CSV_URL = 'https://raw.githubusercontent.com/tianwen1209/BatteryLake-Benchmark-DataPrep/main/dataset_registry.csv';

/* ══════════════════════════════════════════════════════════════
   FALLBACK DATA — used when GitHub fetch fails (e.g. offline / CORS)
   ══════════════════════════════════════════════════════════════ */
const FALLBACK_DATASETS = [
  { id:'dataset_01', name:'NASA PCoE Battery Aging', ref_name:'2007_NASA_PCoE_LCO_18650_1C_1C_25T', status:'done', category:'cycle_aging', chemistry:'LCO', cells:'34', form:'18650', cycles:5600, size_mb:180, notes:'34 LCO 18650 cells; 7.28M timeseries rows; charge/discharge/impedance', doi:'https://data.nasa.gov', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/18'},
  { id:'dataset_02', name:'CALCE CS2 Battery Aging', ref_name:'2013_CALCE_UMD_LCO_18650_0.5C_1C_25T', status:'done', category:'cycle_aging', chemistry:'LCO', cells:'16', form:'18650', cycles:16000, size_mb:420, notes:'CS2/CX2 LCO 18650; Excel format; 1000+ cycles', doi:'https://calce.umd.edu', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/18'},
  { id:'dataset_03', name:'Stanford-MIT-TRI Fast Charging', ref_name:'2019_Stanford_MIT_TRI_LFP_18650_MultiC_30T', status:'done', category:'cycle_aging', chemistry:'LFP', cells:'124', form:'18650', cycles:96000, size_mb:2300, notes:'124 LFP/graphite cells; multi-protocol fast charging; Severson et al. Nature Energy 2019', doi:'https://doi.org/10.1038/s41560-019-0356-8', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/19'},
  { id:'dataset_04', name:'Oxford Battery Degradation', ref_name:'2019_Oxford_Howey_LCO-NCA_18650-Pouch_1C_1C_25T', status:'wip', category:'cycle_aging', chemistry:'Multi', cells:'20', form:'Multi', cycles:7200, size_mb:85, notes:'Kokam LCO 8 pouch cells (done); NCA 18650 12 cells (.mat conversion in progress); Oxford Howey group', doi:'https://howey.eng.ox.ac.uk/data-and-code/', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/25'},
  { id:'dataset_05', name:'RWTH Aachen Lithium-Ion', ref_name:'2021_RWTH_Aachen_NMC_18650_MultiC_MultiT', status:'done', category:'cycle_aging', chemistry:'NMC', cells:'48', form:'18650', cycles:38000, size_mb:650, notes:'RWTH Aachen; NMC/Graphite; CSV format; 48 samples', doi:'', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/21'},
  { id:'dataset_06', name:'SNL BatteryArchive Abuse Testing', ref_name:'2020_SNL_BatteryArchive_MultiChem_MultiForm_MultiC_MultiT', status:'done', category:'safety', chemistry:'Multi', cells:'—', form:'Multi', cycles:2400, size_mb:310, notes:'Sandia National Lab; abuse testing; multiple chemistries', doi:'https://batteryarchive.org', processed_url:'', student:'Cao Han', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/20'},
  { id:'dataset_07', name:'HNEI BatteryArchive NMC', ref_name:'2020_HNEI_BatteryArchive_NMC_18650_MultiC_25T', status:'done', category:'cycle_aging', chemistry:'NMC', cells:'14', form:'18650', cycles:14000, size_mb:280, notes:'Hawaii Natural Energy Institute; NMC 18650 cells', doi:'https://batteryarchive.org', processed_url:'', student:'Cao Han', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/20'},
  { id:'dataset_08', name:'UL-Purdue BatteryArchive NCA', ref_name:'2020_UL_PUR_BatteryArchive_NCA_18650_0.5C_0.5C_23T', status:'done', category:'cycle_aging', chemistry:'NCA', cells:'21', form:'18650', cycles:9000, size_mb:200, notes:'UL-PUR / UL-Purdue; 21 NCA 18650 cylindrical cells; 23°C; 0.5C/0.5C protocol', doi:'https://batteryarchive.org', processed_url:'', student:'Cao Han', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/20'},
  { id:'dataset_09', name:'XJTU NCM Prismatic', ref_name:'2023_XJTU_NCM_Prismatic_1C_1C_25T', status:'done', category:'cycle_aging', chemistry:'NMC', cells:'55', form:'Prismatic', cycles:22000, size_mb:340, notes:"Xi'an Jiaotong University; NCM prismatic; Zenodo 2023", doi:'', processed_url:'', student:'Cao Han', meta:'yes',ts:'yes',cs:'yes',qc:'yes',updated:'2026/3/20'},

  // ── Pending: unassigned datasets (10–30) ──
  { id:'dataset_10', name:'Kaggle EV Battery Charging', ref_name:'2023_Kaggle_LiIon_Unknown_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'Unknown', cells:'—', form:'Unknown', cycles:0, size_mb:0, notes:'Kaggle EV battery charging data; possibly synthetic/toy dataset', doi:'https://www.kaggle.com/datasets/ziya07/ev-battery-charging-data', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_11', name:'KIT NMC/C-SiO 228 Cells', ref_name:'2024_KIT_NMC-SiO_18650_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'228', form:'18650', cycles:0, size_mb:0, notes:'Karlsruhe Institute; 228 NMC/C-SiO cells; 30B+ data points; Sci Data 2024', doi:'https://doi.org/10.1038/s41597-024-03831-x', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_12', name:'Tsinghua Li-ion EV Field', ref_name:'2022_Tsinghua_LiIon_EV_MultiChem_MultiC_MultiT', status:'pending', category:'ev', chemistry:'Multi', cells:'—', form:'EV-BMS', cycles:0, size_mb:0, notes:'Tsinghua University; real-world EV battery cycle data', doi:'https://data.mendeley.com/datasets/279783p5df/1', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_13', name:'Stanford-TRI High-Power NMC', ref_name:'2021_Stanford_TRI_NMC_Prismatic_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'Prismatic', cycles:0, size_mb:0, notes:'Stanford & TRI; high-power NMC cells; EV field data', doi:'https://data.mendeley.com/datasets/mcsh4hnb8b/1', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_14', name:'KIT NMC/C-SiO Characterization', ref_name:'2021_KIT_NMC-SiO_18650_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'KIT; high-power Li-ion NMC/C-SiO characterization; OSF', doi:'https://osf.io/9ceav/', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_15', name:'IVST Changan Large-Scale NEV', ref_name:'2023_IVST_Changan_LiIon_EV_MultiChem_MultiC_MultiT', status:'pending', category:'ev', chemistry:'Multi', cells:'—', form:'EV-BMS', cycles:0, size_mb:0, notes:'IVST/Changan; real-world large-scale NEV Li-ion battery dataset', doi:'http://ivstskl.changan.com.cn/?p=2697', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_16', name:'TBSI-Lijing Pulse Voltage', ref_name:'2024_TBSI_Lijing_LiIon_Retired_PulseVoltage_MultiT', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'TBSI & Lijing; retired batteries; pulse voltage response', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_17', name:'A123 LFP HEV-WLTP Drive Cycle', ref_name:'2021_A123_LFP_18650_2.5Ah_HEV-WLTP_25T', status:'pending', category:'cycle_aging', chemistry:'LFP', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'A123 2.5Ah LFP 18650; HEV WLTP drive cycle; SOH 15-70%', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_18', name:'A123 LFP Calendar+Cycle 50°C', ref_name:'2022_A123_LFP_18650_1.1Ah_CalCyc_50T', status:'pending', category:'cycle_aging', chemistry:'LFP', cells:'20', form:'18650', cycles:0, size_mb:0, notes:'20× A123 LFP 18650 1.1Ah; calendar + cycle aging at 50°C', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_19', name:'Oxford Path-Dependent Degradation', ref_name:'2020_Oxford_Howey_LiIon_PathDep_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'Oxford Howey group; 3-part path-dependent degradation dataset', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_20', name:'Mendeley Drive Cycle Multi-Chem', ref_name:'2021_Mendeley_LFP-NCA-NMC_18650_DriveCycle_MultiT', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'LFP+NCA+NMC; DST/FUDS/UDDS/WLTP/US06 drive cycles; 4 temps', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_21', name:'CMU VTC6 eVTOL Duty Cycle', ref_name:'2023_CMU_Bills_NMC_18650_VTC6_eVTOL_25T', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'Carnegie Mellon Bills group; Sony-Murata VTC6; eVTOL duty cycle; Nat Sci Data 2023', doi:'', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_22', name:'EVERLASTING 4TU (25°C+45°C)', ref_name:'2022_EVERLASTING_4TU_NMC-SiGr_18650_3.5Ah_MultiC_25-45T', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'EU EVERLASTING; Ni-rich Si/Gr 3.5Ah 18650; multi C-rate at 25°C & 45°C', doi:'https://data.4tu.nl/datasets/e42bca59-f1dd-495a-92c9-8b01d6b64040', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_23', name:'EVERLASTING 4TU (0°C+10°C)', ref_name:'2022_EVERLASTING_4TU_NMC-SiGr_18650_3.5Ah_MultiC_0-10T', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'EU EVERLASTING; Ni-rich Si/Gr 3.5Ah 18650; multi C-rate at 0°C & 10°C', doi:'https://data.4tu.nl/datasets/e19fe272-4f46-450c-9125-6545c4c1a98b', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_24', name:'Stanford-Onori Galvanostatic Discharge', ref_name:'2021_Stanford_Onori_NMC-NCA-LFP_18650_MultiC_MultiT', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'Stanford Onori Lab; NMC+NCA+LFP 18650; multi-rate multi-temp galvanostatic', doi:'https://data.mendeley.com/datasets/kxsbr4x3j2/2', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_25', name:'Stanford-Onori EV Real-Driving', ref_name:'2022_Stanford_Onori_NMC_Cyl_RealDriving_MultiT', status:'pending', category:'cycle_aging', chemistry:'NMC', cells:'—', form:'Cyl', cycles:0, size_mb:0, notes:'Stanford Onori Lab; NMC cells; real EV driving profile aging', doi:'https://osf.io/qsabn/', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_26', name:'Stanford-Onori Parallel Cells', ref_name:'2024_Stanford_Onori_LiIon_Parallel_MultiC_25T', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'Stanford Onori Lab; parallel-connected Li-ion; cell-to-cell imbalance', doi:'https://data.mendeley.com/datasets/zh58byr53c/1', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_27', name:'Stanford-Onori Second-Life Grid', ref_name:'2024_Stanford_Onori_LiIon_SecondLife_GridStorage_25T', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'Stanford Onori Lab; second-life Li-ion grid storage cycling aging', doi:'https://osf.io/8jnr5/', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_28', name:'Stanford-Onori LFP SOC ML', ref_name:'2024_Stanford_Onori_LFP_Cyl_SOC-ML_25T', status:'pending', category:'cycle_aging', chemistry:'LFP', cells:'—', form:'Cyl', cycles:0, size_mb:0, notes:'Stanford Onori Lab; LFP; coulomb counting + ML SOC estimation', doi:'https://github.com/LeXuSECL/ML_SOC_Estimation_ACS_Energy_Letters', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_29', name:'Stanford-Onori Calendar Aging', ref_name:'2025_Stanford_Onori_LiIon_Calendar_MultiT', status:'pending', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'Stanford Onori Lab; Li-ion calendar aging; decade-long; Lam et al. Joule 2025', doi:'https://osf.io/ju325/', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_30', name:'Beihang EV Fault Diagnosis', ref_name:'2025_Beihang_LiIon_EV-BMS_MultiChem_MultiT', status:'pending', category:'ev', chemistry:'Multi', cells:'515 EVs', form:'EV-BMS', cycles:0, size_mb:0, notes:'Beihang Univ; 515 real EVs; 18.2M BMS entries; 3 manufacturers; fault labels TR/EL/ISC/EA; Nat Commun 2025', doi:'https://doi.org/10.5281/zenodo.10656500', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},

  // ── Auxiliary physical datasets (31–35): not on main benchmark line, kept for reference ──
  { id:'dataset_31', name:'Mendeley NMC811-LFP Relaxation', ref_name:'2023_Mendeley_NMC811-LFP_18650_Relaxation_MultiT', status:'pending', category:'eis', chemistry:'Multi', cells:'—', form:'18650', cycles:0, size_mb:0, notes:'Auxiliary physical dataset: relaxation/rest voltage; NMC811+LFP; SOH estimation reference', doi:'https://data.mendeley.com/datasets/y8nstxmdrg/1', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_32', name:'Figshare LFP Pouch EIS', ref_name:'2023_Figshare_LFP_Pouch_0.6Ah_EIS_MultiT', status:'pending', category:'eis', chemistry:'LFP', cells:'—', form:'Pouch', cycles:0, size_mb:0, notes:'Auxiliary physical dataset: EIS frequency sweep; 600 mAh LFP pouch; impedance spectra', doi:'https://figshare.com/articles/dataset/Li-ion_Batteries_EIS_measurements/23736582', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_33', name:'TUM Thermal Runaway Propagation', ref_name:'2023_TUM_NMC811-LFP_Auto_ThermalRunaway_MultiT', status:'pending', category:'safety', chemistry:'Multi', cells:'—', form:'Auto', cycles:0, size_mb:0, notes:'Auxiliary physical dataset: thermal runaway propagation; NMC-811+LFP automotive modules', doi:'https://mediatum.ub.tum.de/node?id=1717758', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_34', name:'Mendeley Mech-Induced Thermal Runaway', ref_name:'2023_Mendeley_LiIon_MechAbuse_NailPenetration_MultiT', status:'pending', category:'safety', chemistry:'Unknown', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'Auxiliary physical dataset: mechanical abuse / nail penetration; thermal runaway trigger', doi:'https://data.mendeley.com/datasets/sn2kv34r4h/2', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
  { id:'dataset_35', name:'Zenodo ARC Calorimetry 21700', ref_name:'2023_Zenodo_NMC-NCA-LFP_21700_ARC_Calorimetry_MultiT', status:'pending', category:'safety', chemistry:'Multi', cells:'—', form:'21700', cycles:0, size_mb:0, notes:'Auxiliary physical dataset: ARC exothermal; 21700; NMC/NCA/LFP; thermal safety', doi:'https://zenodo.org/records/7707929', processed_url:'', student:'—', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},

  // ── Liu Kefan: datasets 36–38 ──
  { id:'dataset_36', name:'Imperial College 21700 Cycle Aging', ref_name:'2024_Imperial_Kirkaldy_NMC_21700_MultiC_MultiT', status:'done', category:'cycle_aging', chemistry:'NMC', cells:'21', form:'21700', cycles:14500, size_mb:520, notes:'LG M50T/GBM50T 21700; 3 temps; J. Power Sources 2024', doi:'https://doi.org/10.5281/zenodo.10637534', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'no',updated:'2026/4/5'},
  { id:'dataset_37', name:'Munich Multistage Aging Samsung 21700', ref_name:'2024_TUM_Stroebl_NMC_21700_Multistage_25T', status:'done', category:'cycle_aging', chemistry:'NMC', cells:'279', form:'21700', cycles:67000, size_mb:3800, notes:'279× Samsung INR21700-50E; 71 aging conditions; Scientific Data 2024', doi:'https://doi.org/10.1038/s41597-024-03859-z', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'no',updated:'2026/4/5'},
  { id:'dataset_38', name:'ISU-ILCC Battery Aging', ref_name:'2023_ISU_ILCC_Thelen_LFP_Cyl_MultiC_25T', status:'done', category:'cycle_aging', chemistry:'LFP', cells:'88', form:'Cyl', cycles:31000, size_mb:610, notes:'Iowa State Univ; Li-ion multi-condition cycle aging', doi:'https://zenodo.org/records/7271567', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'no',updated:'2026/4/5'},
  { id:'dataset_eee', name:'NTU Ampace-Samsung 21700', ref_name:'2026_NTU_Ampace-Samsung_LFP-NMC_21700_2C_2C_25T', status:'done', category:'cycle_aging', chemistry:'Multi', cells:'16', form:'21700', cycles:9095, size_mb:240, notes:'NTU; Ampace 21700A + Samsung 35E; 16 cells; 9,095 cycles', doi:'', processed_url:'', student:'Liu Kefan', meta:'yes',ts:'yes',cs:'yes',qc:'no',updated:'2026/3/25'},
  { id:'dataset_internal_MSE', name:'NTU Internal Battery Dataset', ref_name:'2026_NTU_Internal_LFP-NCA_MultiForm_MultiC_MultiT', status:'done', category:'cycle_aging', chemistry:'Multi', cells:'—', form:'Multi', cycles:0, size_mb:0, notes:'NTU internal dataset; LFP/NCA cells; OneDrive shared internal access', doi:'', processed_url:'', student:'Cao Han', meta:'yes',ts:'yes',cs:'yes',qc:'no',updated:'—'},
  { id:'dataset_internal', name:'BatteryLake Internal Experiment', ref_name:'TBD_NTU_Internal_LiIon_TBD_TBD_TBD', status:'pending', category:'cycle_aging', chemistry:'Unknown', cells:'—', form:'—', cycles:0, size_mb:0, notes:'Internal experiment data; to be provided by supervisor', doi:'', processed_url:'', student:'TBD', meta:'no',ts:'no',cs:'no',qc:'no',updated:'—'},
];

/* ══════════════════════════════════════════════════════════════
   LIVE STATE — this is what the UI renders from
   ══════════════════════════════════════════════════════════════ */
let DATASETS = [...FALLBACK_DATASETS];
let dataSource = 'fallback'; // 'github' or 'fallback'

/* ══════════════════════════════════════════════════════════════
   TEMP: hide selected datasets from the Datasets catalog UI only.
   Underlying DATASETS / CSV data is unchanged. Empty both sets to restore.
   ══════════════════════════════════════════════════════════════ */
const HIDDEN_FROM_CATALOG_IDS = new Set([
  'dataset_eee',
  'dataset_internal_MSE',
  'dataset_internal',
]);
const HIDDEN_FROM_CATALOG_REF_NAMES = new Set([
  '2026_NTU_Ampace-Samsung_LFP-NMC_21700_2C_2C_25T',
  '2026_NTU_Internal_LFP-NCA_MultiForm_MultiC_MultiT',
  'TBD_NTU_Internal_LiIon_TBD_TBD_TBD',
]);

function isHiddenFromCatalog(d) {
  return !!(d && (HIDDEN_FROM_CATALOG_IDS.has(d.id) || HIDDEN_FROM_CATALOG_REF_NAMES.has(d.ref_name)));
}

/** Datasets page list/search/filter/count source (excludes temporarily hidden rows). */
function getCatalogDatasets() {
  return DATASETS.filter(d => !isHiddenFromCatalog(d));
}

/* ══════════════════════════════════════════════════════════════
   CSV → DATASETS PARSER
   ══════════════════════════════════════════════════════════════ */
function extractChemistry(refName, notes) {
  const rn = (refName || '').toUpperCase();
  const n  = (notes || '').toUpperCase();
  const chems = ['LFP','NMC811','NMC','NCM','LCO','NCA'];
  // Check ref_name first — it's the most reliable source
  for (const c of chems) {
    if (rn.includes(c)) return c === 'NCM' ? 'NMC' : c === 'NMC811' ? 'NMC' : c;
  }
  if (rn.includes('MULTICHEM') || rn.includes('MULTI')) return 'Multi';
  // Fallback to notes
  for (const c of chems) {
    if (n.includes(c)) return c === 'NCM' ? 'NMC' : c === 'NMC811' ? 'NMC' : c;
  }
  if (n.includes('LI-ION') || n.includes('LIION') || n.includes('LI ION')) return 'Unknown';
  return 'Unknown';
}

function extractFormFactor(refName, notes) {
  const rn = (refName || '') + ' ' + (notes || '');
  if (/21700/i.test(rn)) return '21700';
  if (/18650/i.test(rn)) return '18650';
  if (/pouch/i.test(rn)) return 'Pouch';
  if (/prismatic/i.test(rn)) return 'Prismatic';
  if (/coin/i.test(rn)) return 'Coin';
  if (/cyl/i.test(rn))  return 'Cyl';
  if (/ev.?bms/i.test(rn)) return 'EV-BMS';
  if (/auto/i.test(rn)) return 'Auto';
  return '—';
}

function extractCellCount(notes) {
  if (!notes) return '—';
  // Match patterns like "34 cells", "124 LFP", "515 EVs", "279×", "16 cells"
  const m = notes.match(/(\d+)\s*[×x]?\s*(cells?|EVs?|samples?|LFP|LCO|NMC|NCA|Kokam|Samsung|Ampace)/i);
  if (m) return m[1];
  const m2 = notes.match(/(\d+)[×x]\s/);
  if (m2) return m2[1];
  return '—';
}

function extractCategory(cat, notes) {
  const c = (cat || '').toLowerCase();
  const n = (notes || '').toLowerCase();
  if (c.includes('safety') || n.includes('abuse') || n.includes('thermal runaway') || n.includes('nail penetration')) return 'safety';
  if (c.includes('eis') || n.includes('eis') || n.includes('impedance') || n.includes('relaxation')) return 'eis';
  if (c.includes('ev') || n.includes(' ev ') || n.includes('bms') || n.includes('fleet')) return 'ev';
  return 'cycle_aging';
}

function csvRowToDataset(row) {
  const id     = (row.dataset_id || '').trim();
  const name   = (row.dataset_name || '').trim();
  const ref    = (row.ref_name || '').trim();
  const status = (row.status || 'pending').trim().toLowerCase();
  const notes  = (row.notes || '').trim();
  const cat    = extractCategory(row.data_category, notes);
  const chem   = extractChemistry(ref, notes);
  const form   = extractFormFactor(ref, notes);
  const cells  = extractCellCount(notes);
  const doi    = (row.doi || row.source_url || '').trim();
  const student = (row.assigned_student || '—').trim();
  // Optional numeric fields from CSV if present
  const cycles = parseInt((row.cycles || row.total_cycles || '0').toString().replace(/[,\s]/g,''), 10) || 0;
  const size_mb = parseFloat((row.size_mb || row.data_size_mb || '0').toString()) || 0;

  return {
    id, name, ref_name: ref || '—', status: status || 'pending',
    category: cat, chemistry: chem, cells, form, notes,
    cycles, size_mb,
    doi, student,
    meta: (row.metadata_done || 'no').trim().toLowerCase(),
    ts:   (row.timeseries_done || 'no').trim().toLowerCase(),
    cs:   (row.cycle_summary_done || 'no').trim().toLowerCase(),
    qc:   (row.qc_done || 'no').trim().toLowerCase(),
    updated: (row.last_updated || '—').trim(),
  };
}

function parseCSVToDatasets(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: h => h.trim(),
  });
  // Filter out rows without a dataset_id
  return result.data
    .filter(row => row.dataset_id && row.dataset_id.trim())
    .map(csvRowToDataset);
}

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ══════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'info', duration = 3500) {
  // Remove existing toast
  const old = document.getElementById('toast');
  if (old) old.remove();

  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.classList.add('show'); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, duration);
}

/* ══════════════════════════════════════════════════════════════
   SYNC FROM GITHUB
   ══════════════════════════════════════════════════════════════ */
async function syncFromGitHub(silent = false) {
  const btn = document.getElementById('sync-btn');
  const statusEl = document.getElementById('sync-status');
  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
  }

  try {
    const res = await fetch(GITHUB_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const parsed = parseCSVToDatasets(text);

    if (parsed.length === 0) throw new Error('CSV parsed but 0 rows');

    DATASETS = parsed;
    dataSource = 'github';

    // Update UI
    refreshAll();
    if (statusEl) statusEl.innerHTML = '<span class="sync-dot live"></span> Live · ' + getCatalogDatasets().length + ' datasets';
    if (!silent) showToast('Synced from GitHub — ' + DATASETS.length + ' datasets loaded', 'success');
  } catch (e) {
    console.warn('GitHub sync failed:', e.message);
    if (dataSource !== 'github' && dataSource !== 'local') {
      DATASETS = [...FALLBACK_DATASETS];
      dataSource = 'fallback';
    }
    refreshAll();
    const label = dataSource === 'local' ? 'Local' : 'Built-in';
    if (statusEl) statusEl.innerHTML = '<span class="sync-dot fallback"></span> ' + label + ' · ' + getCatalogDatasets().length + ' datasets';
    if (!silent) showToast('GitHub fetch failed (private repo requires auth). Use "Upload CSV" instead.', 'error', 5000);
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   LOCAL CSV UPLOAD — avoids GitHub private-repo auth issues
   ══════════════════════════════════════════════════════════════ */
function handleLocalCSV(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('sync-status');
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const parsed = parseCSVToDatasets(text);
      if (parsed.length === 0) throw new Error('CSV parsed but 0 rows. Check column headers.');

      DATASETS = parsed;
      dataSource = 'local';
      refreshAll();
      if (statusEl) statusEl.innerHTML = '<span class="sync-dot live"></span> Local · ' + getCatalogDatasets().length + ' datasets';
      showToast('Loaded ' + DATASETS.length + ' datasets from ' + file.name, 'success');
    } catch (err) {
      console.error('CSV parse error:', err);
      showToast('Could not parse CSV — ' + err.message, 'error', 5000);
    } finally {
      // reset input so selecting the same file again re-triggers change
      event.target.value = '';
    }
  };

  reader.onerror = function() {
    showToast('Failed to read file', 'error');
    event.target.value = '';
  };

  reader.readAsText(file);
}

/* ══════════════════════════════════════════════════════════════
   REFRESH ALL PAGES
   ══════════════════════════════════════════════════════════════ */
function refreshAll() {
  document.getElementById('ds-count-badge').textContent = getCatalogDatasets().length;
  renderMetrics();
  renderAppliedFilterChips();
  filterDatasets();
  renderTasks();

  // Benchmark page dataset counters — update all elements tagged data-dynamic="ds-count"
  document.querySelectorAll('[data-dynamic="ds-count"]').forEach(el => {
    el.textContent = DATASETS.length;
  });
  const bdc = document.getElementById('bench-ds-count');
  if (bdc) bdc.textContent = DATASETS.length;

  if (typeof bwRefresh === 'function') bwRefresh();
}

/* ══════════════════════════════════════════════════════════════
   METRICS PANEL — 10 aggregate indicators
   ══════════════════════════════════════════════════════════════ */
function extractSourceFromRef(ref) {
  // ref_name format: YYYY_SOURCE_..._ — we pick the second token as source
  if (!ref || ref === '—') return null;
  const parts = ref.split('_');
  if (parts.length < 2) return null;
  // handle multi-word source like "NASA_PCoE", "Stanford_MIT_TRI"
  // Heuristic: collect tokens until one looks like a chemistry (LFP/NMC/LCO/NCA/Multi...)
  const chemRe = /^(LFP|NMC\d*|NCM\d*|LCO|NCA|MultiChem|LiIon)$/i;
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    if (chemRe.test(parts[i])) break;
    // also break on form-factor token just in case
    if (/^(18650|21700|Pouch|Prismatic|Cyl|Coin)$/i.test(parts[i])) break;
    out.push(parts[i]);
  }
  return out.length ? out.join('_') : parts[1];
}

function extractTempFromRef(ref) {
  // look for last token like "25T" or "MultiT"
  if (!ref) return null;
  const m = ref.match(/_(\d{1,3})T$/i);
  if (m) return parseInt(m[1], 10);
  if (/_MultiT$/i.test(ref)) return 'multi';
  return null;
}

function extractYearFromRef(ref) {
  if (!ref) return null;
  const m = ref.match(/^(\d{4})_/);
  return m ? parseInt(m[1], 10) : null;
}

function renderMetrics() {
  animateHomeMetrics();
}

let homeMetricAnimation = null;

function setHomeMetric(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function animateHomeMetrics() {
  const metricsEl = document.getElementById('metrics-panel');
  if (!metricsEl) return;

  const duration = 1400;
  const final = {
    datasets: 41,
    labs: 34,
    years: 19,
    cyclesK: 331.8,
    cells: 1499,
    volumeGB: 9.7
  };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = progress => {
    const p = ease(progress);
    setHomeMetric('m-datasets', String(Math.round(final.datasets * p)));
    setHomeMetric('m-labs', String(Math.round(final.labs * p)));
    setHomeMetric('m-years', String(Math.round(final.years * p)));
    setHomeMetric('m-cycles', `${(final.cyclesK * p).toFixed(1)}<span class="metric-unit">K</span>`);
    setHomeMetric('m-cells', Math.round(final.cells * p).toLocaleString('en-US'));
    setHomeMetric('m-volume', `${(final.volumeGB * p).toFixed(1)} <span class="metric-unit">GB</span>`);
    if (progress >= 1) {
      setHomeMetric('m-datasets', '41+');
      setHomeMetric('m-labs', '34+');
      setHomeMetric('m-years', '19');
      setHomeMetric('m-cycles', '331.8<span class="metric-unit">K</span>');
      setHomeMetric('m-cells', '1499+');
      setHomeMetric('m-volume', '9.7 <span class="metric-unit">GB</span>');
    }
  };

  if (homeMetricAnimation) cancelAnimationFrame(homeMetricAnimation);
  if (prefersReducedMotion) {
    render(1);
    return;
  }

  const start = performance.now();
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    render(progress);
    if (progress < 1) {
      homeMetricAnimation = requestAnimationFrame(tick);
    } else {
      homeMetricAnimation = null;
    }
  };
  render(0);
  homeMetricAnimation = requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════════
   RENDERING (same as before, but reads from mutable DATASETS)
   ══════════════════════════════════════════════════════════════ */
let activeChems = new Set();
let activeForms = new Set();
let activeCategories = new Set();
let activeSort = 'oldest';
let activeDomains = new Set();
let activeDuties = new Set();
let allDatasetsApplied = false;
let expandedDatasetCategories = new Set(['cycle_aging']);
let pendingChems = new Set();
let pendingForms = new Set();
let pendingCategories = new Set();
let pendingDomains = new Set();
let pendingDuties = new Set();
let pendingAllDatasets = false;

const FILTER_TYPE_STYLES = {
  chemistry: { cls: 'filter-type-chemistry' },
  category: { cls: 'filter-type-category' },
  profile: { cls: 'filter-type-profile' },
  form: { cls: 'filter-type-form' },
  domain: { cls: 'filter-type-domain' },
  all: { cls: 'filter-type-all' },
  status: { cls: 'filter-type-status' }
};
function filterTypeClass(type) {
  return 'filter-token ' + ((FILTER_TYPE_STYLES[type] || FILTER_TYPE_STYLES.status).cls);
}

const DATASET_CATEGORIES = [
  { key: 'cycle_aging', label: 'Cycle Aging', icon: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.22-8.56"/><path d="M21 4v6h-6"/></svg>' },
  { key: 'safety', label: 'Safety', icon: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg>' },
  { key: 'eis', label: 'EIS', icon: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 17c3-9 5 3 8-6s5 3 8-4"/><path d="M4 20h16M4 4v16"/></svg>' },
  { key: 'ev', label: 'EV Field', icon: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 17h10l2-7H5l2 7z"/><path d="M7 17l-1 3M17 17l1 3M8 10l1-4h6l1 4"/><circle cx="9" cy="20" r="1"/><circle cx="15" cy="20" r="1"/></svg>' }
];

function datasetCategoryToggleIcon(expanded) {
  return expanded
    ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>'
    : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
}

function toggleDatasetCategorySection(cat) {
  if (expandedDatasetCategories.has(cat)) {
    expandedDatasetCategories.delete(cat);
  } else {
    expandedDatasetCategories.add(cat);
  }
  filterDatasets();
}

function getChemClass(chem) {
  if (!chem) return 'chem-Unknown';
  if (chem.includes('LFP')) return 'chem-LFP';
  if (chem.includes('NMC') || chem.includes('NCM')) return 'chem-NMC';
  if (chem.includes('LCO')) return 'chem-LCO';
  if (chem.includes('NCA')) return 'chem-NCA';
  if (chem.includes('Multi')) return 'chem-Multi';
  return 'chem-Unknown';
}
function getChemLabel(chem) { return getChemClass(chem).replace('chem-',''); }
function getCatClass(cat) {
  if (cat === 'cycle_aging') return 'cat-cycle';
  if (cat === 'safety') return 'cat-safety';
  if (cat === 'eis') return 'cat-eis';
  if (cat === 'ev') return 'cat-ev';
  return '';
}
function getCatLabel(cat) {
  return { cycle_aging:'Cycle Aging', safety:'Safety', eis:'EIS/Impedance', ev:'EV Field Data' }[cat] || cat;
}
function getSectionCatLabel(cat) {
  const found = DATASET_CATEGORIES.find(c => c.key === cat);
  return found ? found.label : getCatLabel(cat);
}
function getCategorySlug(cat) {
  return { cycle_aging: 'cycle-aging', safety: 'safety', eis: 'eis', ev: 'ev-field' }[cat] || cat;
}
function getCategoryFromSlug(slug) {
  return { 'cycle-aging': 'cycle_aging', safety: 'safety', eis: 'eis', 'ev-field': 'ev' }[slug] || null;
}
function hasAppliedDatasetFilters() {
  return activeChems.size > 0 || activeForms.size > 0 || activeCategories.size > 0 || activeDomains.size > 0 || activeDuties.size > 0;
}
function hasSearchText() {
  const input = document.getElementById('searchInput');
  return !!(input && input.value.trim());
}
function isDatasetResultsMode() {
  return hasSearchText() || hasAppliedDatasetFilters() || allDatasetsApplied;
}
function cloneSet(set) { return new Set(Array.from(set)); }
function syncPendingFromActive() {
  pendingChems = cloneSet(activeChems);
  pendingForms = cloneSet(activeForms);
  pendingCategories = cloneSet(activeCategories);
  pendingDomains = cloneSet(activeDomains);
  pendingDuties = cloneSet(activeDuties);
  pendingAllDatasets = allDatasetsApplied;
  syncFilterPopupTags();
}
function syncFilterPopupTags() {
  document.querySelectorAll('.filter-tag[data-chem]').forEach(t => t.classList.toggle('active', pendingChems.has(t.dataset.chem)));
  document.querySelectorAll('.filter-tag[data-form]').forEach(t => t.classList.toggle('active', pendingForms.has(t.dataset.form)));
  document.querySelectorAll('.filter-tag[data-cat]').forEach(t => t.classList.toggle('active', pendingCategories.has(t.dataset.cat)));
  document.querySelectorAll('.filter-tag[data-domain]').forEach(t => t.classList.toggle('active', pendingDomains.has(t.dataset.domain)));
  document.querySelectorAll('.filter-tag[data-duty]').forEach(t => t.classList.toggle('active', pendingDuties.has(t.dataset.duty)));
  const all = document.querySelector('.filter-tag[data-all-datasets]');
  if (all) all.classList.toggle('active', pendingAllDatasets);
}
function clearPendingAllDatasets() {
  pendingAllDatasets = false;
  const all = document.querySelector('.filter-tag[data-all-datasets]');
  if (all) all.classList.remove('active');
}
function updatePendingSet(set, value, el) {
  clearPendingAllDatasets();
  if (set.has(value)) set.delete(value); else set.add(value);
  el.classList.toggle('active', set.has(value));
}
function inferDatasetDomains(d) {
  const n = (d.notes || '').toLowerCase();
  const c = d.category || '';
  const out = [];
  if (c === 'ev' || n.includes('ev') || n.includes('vehicle') || n.includes('bms') || n.includes('fleet')) out.push('EV');
  if (n.includes('grid') || n.includes('storage') || n.includes('stationary')) out.push('Grid');
  if (!out.length && (c === 'cycle_aging' || c === 'eis' || n.includes('lab') || n.includes('controlled'))) out.push('Lab');
  return out;
}
function inferDatasetProfiles(d) {
  const rn = (d.ref_name || '').toLowerCase();
  const n = (d.notes || '').toLowerCase();
  const out = [];
  if (rn.includes('1c') || n.includes('cc/cv') || n.includes('cccv') || rn.includes('_1c_') || rn.match(/_\d+c_/i)) out.push('CC/CV');
  if (n.includes('dynamic') || n.includes('drive cycle') || n.includes('pulse') || rn.includes('hppc')) out.push('Dynamic');
  if (rn.includes('multic') || n.includes('multi-protocol') || n.includes('multi-condition') || n.includes('fast charging')) out.push('Multi-rate');
  return out;
}
function renderAppliedFilterChips() {
  const box = document.getElementById('applied-filter-chips');
  if (!box) return;
  const chips = [];
  if (allDatasetsApplied) chips.push({ type: 'all', tokenType: 'all', value: 'all', label: 'All datasets' });
  activeChems.forEach(v => chips.push({ type: 'chem', tokenType: 'chemistry', value: v, label: v }));
  activeForms.forEach(v => chips.push({ type: 'form', tokenType: 'form', value: v, label: v }));
  activeCategories.forEach(v => chips.push({ type: 'cat', tokenType: 'category', value: v, label: getSectionCatLabel(v) }));
  activeDomains.forEach(v => chips.push({ type: 'domain', tokenType: 'domain', value: v, label: v.toUpperCase() === 'EV' ? 'EV' : v.charAt(0).toUpperCase() + v.slice(1) }));
  activeDuties.forEach(v => chips.push({ type: 'duty', tokenType: 'profile', value: v, label: ({ cccv: 'CC/CV', dynamic: 'Dynamic', multi: 'Multi-rate' }[v] || v) }));
  box.classList.toggle('has-chips', chips.length > 0);
  box.innerHTML = chips.map(chip => `<span class="applied-chip ${filterTypeClass(chip.tokenType || 'status')}">${esc(chip.label)}<button aria-label="Remove ${esc(chip.label)} filter" onclick="removeAppliedFilter('${chip.type}','${escAttr(chip.value)}')">×</button></span>`).join('');
}
function datasetCardHTML(d) {
  const cyclesNum = Number(d.cycles) || 0;
  const cyclesFmt = cyclesNum > 0
    ? (cyclesNum >= 1000 ? (cyclesNum/1000).toFixed(cyclesNum >= 10000 ? 0 : 1) + 'K' : cyclesNum)
    : null;
  const cardTags = [
    d.category ? `<span class="dc-tag ${filterTypeClass('category')}">${getCatLabel(d.category)}</span>` : '',
    d.chemistry ? `<span class="dc-tag ${filterTypeClass('chemistry')}">${esc(d.chemistry)}</span>` : '',
    ...inferDatasetDomains(d).slice(0, 1).map(v => `<span class="dc-tag ${filterTypeClass('domain')}">${esc(v)}</span>`),
    d.form && d.form !== '—' ? `<span class="dc-tag ${filterTypeClass('form')}">${esc(d.form)}</span>` : '',
    ...inferDatasetProfiles(d).slice(0, 1).map(v => `<span class="dc-tag ${filterTypeClass('profile')}">${esc(v)}</span>`)
  ].filter(Boolean).join('');
  return `
    <div class="dataset-card" onclick="openDatasetModal('${escAttr(d.id)}')">
      <div class="dc-top">
        <div class="dc-icon ${getChemClass(d.chemistry)}">${getChemLabel(d.chemistry).charAt(0)}</div>
        <div class="dc-body">
          <div class="dc-name">${esc(d.ref_name)}</div>
          <div class="dc-refname">${esc(d.name)}</div>
        </div>
      </div>
      <div class="dc-stats">
        <span class="dc-stat">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
          <span class="stat-val">${esc(d.cells)}</span> cells
        </span>
        <span class="dc-stat">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M22 11h-2a2 2 0 000 4h2"/></svg>
          <span class="stat-val">${esc(d.form)}</span>
        </span>
        ${cyclesFmt ? `<span class="dc-stat"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.22-8.56"/><polyline points="21 4 21 10 15 10"/></svg> <span class="stat-val">${cyclesFmt}</span> cycles</span>` : ''}
      </div>
      <div class="dc-tags">
        ${cardTags}
      </div>
    </div>
  `;
}

function renderDatasets(data) {
  const grid = document.getElementById('dataset-grid');
  const countEl = document.getElementById('filter-count');
  const head = document.querySelector('.dataset-results-head');
  const resultsMode = isDatasetResultsMode();
  if (head) head.classList.toggle('browse', !resultsMode);
  if (data.length === 0) {
    grid.innerHTML = '<div class="dataset-empty">No datasets match your filters.</div>';
    countEl.textContent = '0 datasets found';
    return;
  }

  if (resultsMode) {
    grid.innerHTML = `<div class="dataset-card-grid">${data.map(datasetCardHTML).join('')}</div>`;
    countEl.textContent = data.length + ' datasets found';
    return;
  }

  const viewCats = DATASET_CATEGORIES;

  grid.innerHTML = viewCats.map(cat => {
    const allForCat = data.filter(d => d.category === cat.key);
    if (!allForCat.length) return '';
    const expanded = expandedDatasetCategories.has(cat.key);
    return `
      <section class="dataset-section ${expanded ? 'is-expanded' : 'is-collapsed'}">
        <div class="dataset-section-head" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" onclick="toggleDatasetCategorySection('${cat.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDatasetCategorySection('${cat.key}')}">
          <div class="dataset-section-title">
            <span class="dataset-section-icon ${getCatClass(cat.key)}">${cat.icon}</span>
            <h2>${esc(cat.label)}</h2>
            <span class="dataset-section-meta">${allForCat.length}</span>
          </div>
          <button class="dataset-see-all" type="button" aria-label="${expanded ? 'Collapse' : 'Expand'} ${escAttr(cat.label)}" onclick="event.stopPropagation();toggleDatasetCategorySection('${cat.key}')">${datasetCategoryToggleIcon(expanded)}</button>
        </div>
        ${expanded ? `<div class="dataset-card-grid">${allForCat.map(datasetCardHTML).join('')}</div>` : ''}
      </section>
    `;
  }).join('') || '<div class="dataset-empty">No datasets match your filters.</div>';
  countEl.textContent = data.length + ' datasets found';
}

// XSS-safe escape
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escAttr(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function getFiltered() {
  const catalog = getCatalogDatasets();
  if (allDatasetsApplied) return sortDatasets(catalog, activeSort);
  const raw = document.getElementById('searchInput').value.trim().toLowerCase();
  // Multi-token search: split by whitespace, every token must match (AND logic)
  const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];

  const filtered = catalog.filter(d => {
    // Chemistry (multi-select, OR within group)
    if (activeChems.size > 0) {
      let match = false;
      activeChems.forEach(c => { if (d.chemistry && d.chemistry.includes(c)) match = true; });
      if (!match) return false;
    }
    // Form factor (multi-select, OR within group)
    if (activeForms.size > 0) {
      let match = false;
      activeForms.forEach(f => { if (d.form && d.form.toLowerCase() === f.toLowerCase()) match = true; });
      if (!match) return false;
    }
    // Category (empty = no filter)
    if (activeCategories.size > 0 && !activeCategories.has(d.category)) return false;

    // Domain filter (inferred from category/notes)
    if (activeDomains.size > 0) {
      const n = (d.notes || '').toLowerCase();
      const c = d.category || '';
      let domainMatch = false;
      activeDomains.forEach(dom => {
        if (dom === 'lab' && (c === 'cycle_aging' || c === 'eis' || n.includes('lab') || n.includes('controlled'))) domainMatch = true;
        if (dom === 'ev' && (c === 'ev' || n.includes('ev') || n.includes('vehicle') || n.includes('bms') || n.includes('fleet'))) domainMatch = true;
        if (dom === 'grid' && (n.includes('grid') || n.includes('storage') || n.includes('stationary'))) domainMatch = true;
      });
      if (!domainMatch) return false;
    }

    // Duty profile filter (inferred from ref_name/notes)
    if (activeDuties.size > 0) {
      const rn = (d.ref_name || '').toLowerCase();
      const n = (d.notes || '').toLowerCase();
      let dutyMatch = false;
      activeDuties.forEach(duty => {
        if (duty === 'cccv' && (rn.includes('1c') || n.includes('cc/cv') || n.includes('cccv') || (rn.includes('_1c_') || rn.match(/_\d+c_/i)))) dutyMatch = true;
        if (duty === 'dynamic' && (n.includes('dynamic') || n.includes('drive cycle') || n.includes('pulse') || rn.includes('hppc'))) dutyMatch = true;
        if (duty === 'multi' && (rn.includes('multic') || n.includes('multi-protocol') || n.includes('multi-condition') || n.includes('fast charging'))) dutyMatch = true;
      });
      if (!dutyMatch) return false;
    }

    // Multi-token search across all visible text fields
    if (tokens.length > 0) {
      const haystack = [d.name, d.ref_name, d.notes, d.chemistry, d.form, d.id, getCatLabel(d.category)]
        .join(' ').toLowerCase();
      for (const t of tokens) {
        if (!haystack.includes(t)) return false;
      }
    }
    return true;
  });

  // Sort
  return sortDatasets(filtered, activeSort);
}

function sortDatasets(arr, mode) {
  const copy = arr.slice();
  const yearOf = d => extractYearFromRef(d.ref_name) || 0;
  const cellsOf = d => parseInt(('' + d.cells).replace(/[^\d]/g, ''), 10) || 0;
  const cyclesOf = d => Number(d.cycles) || 0;
  switch (mode) {
    case 'oldest':      copy.sort((a,b) => yearOf(a) - yearOf(b)); break;
    case 'most-cells':  copy.sort((a,b) => cellsOf(b) - cellsOf(a)); break;
    case 'most-cycles': copy.sort((a,b) => cyclesOf(b) - cyclesOf(a)); break;
    case 'az':          copy.sort((a,b) => (a.name||'').localeCompare(b.name||'')); break;
    case 'newest':
    default:            copy.sort((a,b) => yearOf(b) - yearOf(a)); break;
  }
  // Keep the TBD placeholder dataset at the bottom of the catalog.
  const pinned = [];
  for (let i = copy.length - 1; i >= 0; i--) {
    const d = copy[i];
    if (d.id === 'dataset_internal' || d.ref_name === 'TBD_NTU_Internal_LiIon_TBD_TBD_TBD') {
      pinned.unshift(copy.splice(i, 1)[0]);
    }
  }
  return copy.concat(pinned);
}

function filterDatasets() { renderDatasets(getFiltered()); }

function toggleChemFilter(el) {
  updatePendingSet(pendingChems, el.dataset.chem, el);
}
function toggleFormFilter(el) {
  updatePendingSet(pendingForms, el.dataset.form, el);
}
function toggleCatFilter(el) {
  updatePendingSet(pendingCategories, el.dataset.cat, el);
}
function changeSort(mode) {
  activeSort = mode;
  filterDatasets();
}

function toggleDomainFilter(el) {
  updatePendingSet(pendingDomains, el.dataset.domain, el);
}
function toggleDutyFilter(el) {
  updatePendingSet(pendingDuties, el.dataset.duty, el);
}

function toggleDatasetFilters() {
  const popover = document.getElementById('dataset-filter-popover');
  const btn = document.querySelector('.dataset-filter-toggle');
  const willOpen = !popover.classList.contains('open');
  if (willOpen) syncPendingFromActive();
  popover.classList.toggle('open', willOpen);
  if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function closeDatasetFilters() {
  const popover = document.getElementById('dataset-filter-popover');
  const btn = document.querySelector('.dataset-filter-toggle');
  if (popover) popover.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleAllDatasetsFilter(el) {
  pendingAllDatasets = !pendingAllDatasets;
  if (pendingAllDatasets) {
    pendingChems.clear();
    pendingForms.clear();
    pendingCategories.clear();
    pendingDomains.clear();
    pendingDuties.clear();
  }
  syncFilterPopupTags();
}

function applyDatasetFilters() {
  allDatasetsApplied = pendingAllDatasets;
  activeChems = pendingAllDatasets ? new Set() : cloneSet(pendingChems);
  activeForms = pendingAllDatasets ? new Set() : cloneSet(pendingForms);
  activeCategories = pendingAllDatasets ? new Set() : cloneSet(pendingCategories);
  activeDomains = pendingAllDatasets ? new Set() : cloneSet(pendingDomains);
  activeDuties = pendingAllDatasets ? new Set() : cloneSet(pendingDuties);
  if (location.hash !== '#datasets') history.replaceState(null, '', '#datasets');
  closeDatasetFilters();
  renderAppliedFilterChips();
  filterDatasets();
}

function clearPendingDatasetFilters() {
  pendingChems.clear();
  pendingForms.clear();
  pendingCategories.clear();
  pendingDomains.clear();
  pendingDuties.clear();
  pendingAllDatasets = false;
  activeChems.clear();
  activeForms.clear();
  activeCategories.clear();
  activeDomains.clear();
  activeDuties.clear();
  allDatasetsApplied = false;
  syncFilterPopupTags();
  renderAppliedFilterChips();
  filterDatasets();
  closeDatasetFilters();
}

document.addEventListener('click', e => {
  const popover = document.getElementById('dataset-filter-popover');
  if (!popover || !popover.classList.contains('open')) return;
  if (e.target.closest('#dataset-filter-popover') || e.target.closest('.dataset-filter-toggle')) return;
  closeDatasetFilters();
});
document.addEventListener('click', e => {
  const popover = document.getElementById('model-filter-popover');
  if (!popover || !popover.classList.contains('open')) return;
  if (e.target.closest('#model-filter-popover') || e.target.closest('.model-filter-toggle')) return;
  mlCloseFilters();
});

function removeAppliedFilter(type, value) {
  if (type === 'all') allDatasetsApplied = false;
  if (type === 'chem') activeChems.delete(value);
  if (type === 'form') activeForms.delete(value);
  if (type === 'cat') activeCategories.delete(value);
  if (type === 'domain') activeDomains.delete(value);
  if (type === 'duty') activeDuties.delete(value);
  syncPendingFromActive();
  renderAppliedFilterChips();
  filterDatasets();
}

function showDatasetCategory(cat) {
  allDatasetsApplied = false;
  activeChems.clear();
  activeForms.clear();
  activeCategories.clear();
  activeCategories.add(cat);
  activeDomains.clear();
  activeDuties.clear();
  syncPendingFromActive();
  renderAppliedFilterChips();
  showPage('datasets', document.getElementById('nav-datasets'), { preserveHash: true });
  if (location.hash !== '#datasets') history.replaceState(null, '', '#datasets');
  filterDatasets();
}

function showAllDatasetCategories() {
  allDatasetsApplied = false;
  activeChems.clear();
  activeForms.clear();
  activeCategories.clear();
  activeDomains.clear();
  activeDuties.clear();
  syncPendingFromActive();
  renderAppliedFilterChips();
  history.replaceState(null, '', '#datasets');
  filterDatasets();
}

function handleDatasetUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length) {
    showToast(files.length === 1 ? 'Selected ' + files[0].name + ' for contribution.' : 'Selected ' + files.length + ' files for contribution.', 'success');
  }
  event.target.value = '';
}

/* Search input handlers */
function onSearchInput() {
  const input = document.getElementById('searchInput');
  const box = document.getElementById('search-box');
  if (input.value) box.classList.add('has-text'); else box.classList.remove('has-text');
  if (input.value.trim() && allDatasetsApplied) {
    allDatasetsApplied = false;
    syncPendingFromActive();
    renderAppliedFilterChips();
  }
  filterDatasets();
}
function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('search-box').classList.remove('has-text');
  input.focus();
  filterDatasets();
}

function runDatasetSearch(query) {
  const q = (query || '').trim();
  if (!q) return false;
  const datasetNav = document.getElementById('nav-datasets');
  showPage('datasets', datasetNav);
  const input = document.getElementById('searchInput');
  const box = document.getElementById('search-box');
  if (input) {
    input.value = q;
    if (box) box.classList.toggle('has-text', Boolean(q));
  }
  allDatasetsApplied = false;
  syncPendingFromActive();
  renderAppliedFilterChips();
  filterDatasets();
  if (input) input.focus();
  return true;
}

function triggerTopbarSearch() {
  const input = document.getElementById('topbarSearchInput');
  if (!input) return;
  runDatasetSearch(input.value);
}
window.triggerTopbarSearch = triggerTopbarSearch;

function setTheme(theme) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  localStorage.setItem('bt-theme', resolved);
  updateThemeLogo(resolved);
  updateThemeToggle();
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
window.toggleTheme = toggleTheme;

function updateThemeLogo(theme) {
  const logo = document.getElementById('sidebar-logo');
  if (!logo) return;
  const isDark = theme === 'dark';
  const nextSrc = isDark ? 'assets/logos/logo-dark.png' : 'assets/logos/logo-light.png';
  if (!logo.getAttribute('src')?.endsWith(nextSrc)) logo.src = nextSrc;
}

function updateThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.dataset.theme === 'dark';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

function initTopbarControls() {
  updateThemeLogo(document.documentElement.dataset.theme);
  updateThemeToggle();
  const input = document.getElementById('topbarSearchInput');
  if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerTopbarSearch();
    }
  });
}

/* ── MODAL ── */
function openDatasetModal(id) {
  const d = DATASETS.find(item => item.id === id);
  if (!d || isHiddenFromCatalog(d)) return;
  document.getElementById('modal-name').textContent = d.name;
  document.getElementById('modal-refname').textContent = d.ref_name;
  document.getElementById('modal-details').innerHTML = `
    <div class="modal-field"><div class="modal-label">ID</div><div class="modal-value mono">${esc(d.id)}</div></div>
    <div class="modal-field"><div class="modal-label">Chemistry</div><div class="modal-value">${esc(d.chemistry)}</div></div>
    <div class="modal-field"><div class="modal-label">Form Factor</div><div class="modal-value">${esc(d.form)}</div></div>
    <div class="modal-field"><div class="modal-label">Cells</div><div class="modal-value">${esc(d.cells)}</div></div>
    <div class="modal-field"><div class="modal-label">Category</div><div class="modal-value">${getCatLabel(d.category)}</div></div>
    <div class="modal-field"><div class="modal-label">Year</div><div class="modal-value">${extractYearFromRef(d.ref_name) || '—'}</div></div>
  `;
  const checks = ['meta','ts','cs','qc'];
  const labels = ['Metadata','Time-series','Cycle Summary','QC'];
  document.getElementById('modal-checklist').innerHTML = checks.map((k,i) =>
    `<div class="check-item"><span class="ci-icon ${d[k]==='yes'?'ci-yes':'ci-no'}">${d[k]==='yes'?'✓':'—'}</span>${labels[i]}</div>`
  ).join('');
  document.getElementById('modal-notes').textContent = d.notes;
  const linksEl = document.getElementById('modal-links');
  const linksSec = document.getElementById('modal-links-section');
  const hasDoi = d.doi && d.doi.startsWith('http');
  const hasProcessed = d.processed_url && d.processed_url.startsWith('http');
  linksSec.style.display = 'block';
  const extIcon = `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const dlIcon  = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const qaIcon  = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M8 15l2.3-4.2 2.4 2 3.3-6.1"/></svg>`;
  const srcBtn = hasDoi
    ? `<a class="modal-link-row modal-link-row--dl" href="${esc(d.doi)}" target="_blank" rel="noopener noreferrer" onclick="if(window.BatteryLakeAnalytics)BatteryLakeAnalytics.trackDatasetDownload({download_type:'source_dataset',dataset_id:'${escAttr(d.id)}',dataset_name:'${escAttr(d.name)}'})"><span class="modal-link-label">Source Dataset</span><span class="modal-link-dl-btn">${extIcon} Source</span></a>`
    : `<div class="modal-link-row modal-link-row--na"><span class="modal-link-label">Source Dataset</span><span class="modal-link-dl-btn modal-link-btn-na">${extIcon} Source</span></div>`;
  const procBtn = hasProcessed
    ? `<a class="modal-link-row modal-link-row--dl" href="${esc(d.processed_url)}" target="_blank" rel="noopener noreferrer" onclick="if(window.BatteryLakeAnalytics)BatteryLakeAnalytics.trackDatasetDownload({download_type:'processed_dataset',dataset_id:'${escAttr(d.id)}',dataset_name:'${escAttr(d.name)}'})"><span class="modal-link-label">Processed Dataset</span><span class="modal-link-dl-btn">${dlIcon} Download</span></a>`
    : `<button class="modal-link-row modal-link-row--dl" onclick="showToast('Processed data for this dataset is coming soon.','info')"><span class="modal-link-label">Processed Dataset</span><span class="modal-link-dl-btn">${dlIcon} Download</span></button>`;
  const qaBtn = `<button class="modal-link-row modal-link-row--dl" type="button" onclick="closeModal(); showDatasetQuality('${esc(d.id)}')"><span class="modal-link-label">Quality Report</span><span class="modal-link-dl-btn">${qaIcon} View</span></button>`;
  linksEl.innerHTML = `<div class="modal-links-row">${srcBtn}${procBtn}${qaBtn}</div>`;
  document.getElementById('modal').classList.add('show');
}
function openModal(idx) {
  const d = getFiltered()[idx];
  if (d) openDatasetModal(d.id);
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── TASKS PAGE ── */
function renderTasks() {
  const tbody = document.getElementById('task-tbody');
  const yn = v => v === 'yes' ? '<span style="color:var(--green);font-weight:600;">✓</span>' : '<span style="color:var(--text4);">—</span>';
  let done=0, wip=0, pending=0, skip=0;
  DATASETS.forEach(d => {
    if (d.status === 'done') done++;
    else if (d.status === 'wip') wip++;
    else if (d.status === 'pending') pending++;
    else skip++;
  });
  document.getElementById('ts-done').textContent = done;
  document.getElementById('ts-wip').textContent = wip;
  document.getElementById('ts-pending').textContent = pending;
  document.getElementById('ts-skip').textContent = skip;
  tbody.innerHTML = DATASETS.map(d => `
    <tr>
      <td style="font-family:var(--mono);font-size:13px;">${esc(d.id)}</td>
      <td>${esc(d.name)}</td>
      <td><span class="status-badge status-${d.status}">${d.status}</span></td>
      <td>${yn(d.meta)}</td><td>${yn(d.ts)}</td><td>${yn(d.cs)}</td><td>${yn(d.qc)}</td>
    </tr>
  `).join('');
}

/* AI-assisted preprocessing prototype */
function prepToast(message) {
  const toast = document.getElementById('prepToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(prepToast.timer);
  prepToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

let currentInspectionManifest = null;
let prepStage = 1;
let prepDroppedFiles = null;
let currentMetadataExtraction = null;
let metadataSourceExtraction = null;
let metadataPaperExtraction = null;
let metadataFinalConfirmed = false;
const METADATA_MISSING_VALUE = 'Source page not stated';
const prepAIFields = [
  { key: 'data_format', label: 'Data format', aliases: ['Data format', 'Format', 'Source format'] },
  { key: 'year', label: 'Year', aliases: ['Year'] },
  { key: 'source_lab', label: 'Source / lab', aliases: ['Source / lab', 'Source', 'Lab'] },
  { key: 'chemistry', label: 'Chemistry', aliases: ['Chemistry'] },
  { key: 'form_factor', label: 'Form factor', aliases: ['Form factor', 'Cell format'] },
  { key: 'c_rate', label: 'C-rate', aliases: ['C-rate', 'Charge C-rate', 'Discharge C-rate'] },
  { key: 'temperature', label: 'Temperature', aliases: ['Temperature'] },
  { key: 'cell_count', label: 'Cell count', aliases: ['Cell count', 'Cells'] },
  { key: 'license', label: 'License', aliases: ['License'] }
];
const BATTERYLAKE_METADATA_FIELDS = [
  'chemistry',
  'cathode_material',
  'anode_material',
  'nominal_capacity_Ah',
  'nominal_voltage_V',
  'temperature_C',
  'charge_protocol',
  'discharge_protocol',
  'C_rate',
  'cutoff_voltage_upper',
  'cutoff_voltage_lower',
  'brand_or_manufacturer',
  'form_factor',
  'source_url',
  'paper_url',
  'license'
];
let prepAIState = prepAIFields.map(field => ({
  ...field,
  value: '',
  evidence: 'No inspection yet',
  confidence: 0,
  confirmed: false,
  pending: true
}));

function showPrepStage(stage) {
  prepStage = Math.max(1, Math.min(5, Number(stage) || 1));
  document.querySelectorAll('[data-prep-stage]').forEach(panel => {
    panel.classList.toggle('active', Number(panel.dataset.prepStage) === prepStage);
  });
  document.querySelectorAll('[data-stage-nav]').forEach(item => {
    const itemStage = Number(item.dataset.stageNav);
    item.classList.toggle('active', itemStage === prepStage);
    item.classList.toggle('done', itemStage < prepStage);
    const number = item.querySelector('.prep-step-num');
    if (number) number.textContent = itemStage < prepStage ? '✓' : String(itemStage);
  });
  const previous = document.getElementById('prepPrevious');
  const next = document.getElementById('prepNext');
  if (previous) previous.disabled = prepStage === 1;
  if (next) {
    next.disabled = prepStage === 5;
    next.textContent = prepStage === 5 ? 'Complete' : 'Next';
  }
}

function setPrepBusy(busy) {
  const progress = document.getElementById('inspectProgress');
  const bar = progress && progress.querySelector('span');
  if (!progress || !bar) return;
  progress.classList.toggle('show', busy);
  bar.style.width = busy ? '72%' : '100%';
  if (!busy) window.setTimeout(() => { progress.classList.remove('show'); bar.style.width = '0'; }, 450);
}

function openBatteryTwinAgent() {
  if (window.batteryTwinAI?.open) window.batteryTwinAI.open();
}

function prepAgentNote(message) {
  if (window.batteryTwinAI?.addBotNote) {
    window.batteryTwinAI.addBotNote(message);
  }
}

function isMetadataMissing(row) {
  const value = String(row?.value || '').trim();
  return row?.status === 'missing' || !value || value === METADATA_MISSING_VALUE;
}

function metadataConfidence(row) {
  const n = Number(row?.confidence || 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

async function fetchMetadataExtraction(url, sourceType) {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/metadata-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, source_type: sourceType })
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    if (!response.ok) throw new Error(data.error || `Metadata backend unavailable (${response.status})`);
    data.source_type = sourceType;
    data.fields = (data.fields || []).map(row => ({ ...row, source_type: sourceType, confirmed: false }));
    return data;
  } catch (error) {
    const fallback = buildMetadataFallback(url, sourceType, error);
    prepAgentNote(`Metadata backend is unavailable, so I generated a conservative browser-side ${sourceType} draft. Missing fields remain "${METADATA_MISSING_VALUE}" and supplementary files may need checking later.`);
    return fallback;
  }
}

function buildMetadataFallback(url, sourceType, error) {
  const rows = BATTERYLAKE_METADATA_FIELDS.map(field => {
    let value = METADATA_MISSING_VALUE;
    let evidence = `${sourceType === 'paper' ? 'Paper' : 'Source page'} could not be read by the local backend; do not guess this field. Supplementary files may need separate checking.`;
    let confidence = 0;
    let status = 'missing';
    if (field === 'source_url' && sourceType === 'source') {
      value = url;
      evidence = 'User-provided dataset source URL.';
      confidence = 1;
      status = 'found';
    }
    if (field === 'paper_url' && sourceType === 'paper') {
      value = url;
      evidence = 'User-provided paper URL / DOI.';
      confidence = 1;
      status = 'found';
    }
    return { field, value, evidence, confidence, status, source_type: sourceType, confirmed: false };
  });
  return {
    source_url: url,
    source_type: sourceType,
    status: 'frontend_fallback',
    message: error?.message || 'Metadata backend unavailable.',
    fields: rows
  };
}

function resetMetadataConfirmation() {
  metadataFinalConfirmed = false;
  const checkbox = document.getElementById('metadataConfirmAll');
  if (checkbox) checkbox.checked = false;
  updateMetadataDownloadState();
}

async function runMetadataSourceCheck() {
  const url = document.getElementById('metadataSourceUrl')?.value.trim();
  if (!url) {
    prepToast('Paste a dataset source URL first.');
    return;
  }
  openBatteryTwinAgent();
  prepAgentNote(`Checking dataset source URL for BatteryLake metadata: ${url}. Missing values will stay as "${METADATA_MISSING_VALUE}" until a paper URL supports them.`);
  setPrepBusy(true);
  try {
    metadataSourceExtraction = await fetchMetadataExtraction(url, 'source');
    metadataPaperExtraction = null;
    currentMetadataExtraction = metadataSourceExtraction;
    resetMetadataConfirmation();
    renderMetadataResult(currentMetadataExtraction);
    const missing = summarizeMetadataMissing(currentMetadataExtraction);
    prepToast(missing.length ? `${missing.length} fields still need paper evidence.` : 'Source URL filled all tracked metadata fields.');
    prepAgentNote(missing.length
      ? `Source URL check finished. Missing fields: ${missing.join(', ')}. Add a paper URL to fill the gaps.`
      : 'Source URL check finished. No missing tracked fields were detected.');
  } catch (error) {
    prepToast(error.message || 'Could not extract metadata.');
    prepAgentNote('Source URL metadata extraction failed. Check that app.py is running and the URL is reachable.');
  } finally {
    setPrepBusy(false);
  }
}

function mergeMetadataExtractions(sourceData, paperData) {
  if (!sourceData) return paperData;
  if (!paperData) return sourceData;
  const paperByField = Object.fromEntries((paperData.fields || []).map(row => [row.field, row]));
  const fields = (sourceData.fields || []).map(sourceRow => {
    const paperRow = paperByField[sourceRow.field];
    if (!paperRow) return sourceRow;
    const sourceMissing = isMetadataMissing(sourceRow);
    const paperMissing = isMetadataMissing(paperRow);
    const paperBetter = !paperMissing && (sourceMissing || metadataConfidence(paperRow) > metadataConfidence(sourceRow));
    return paperBetter ? { ...paperRow, source_type: 'paper', confirmed: false } : sourceRow;
  });
  return {
    ...sourceData,
    paper_url: paperData.source_url,
    fields,
    status: 'source_plus_paper',
    message: 'Metadata merged from dataset source URL and paper URL.'
  };
}

async function runMetadataPaperCheck() {
  if (!metadataSourceExtraction?.fields?.length) {
    prepToast('Check the dataset source URL before adding a paper URL.');
    return;
  }
  const url = document.getElementById('metadataPaperUrl')?.value.trim();
  if (!url) {
    prepToast('Paste a paper URL or DOI first.');
    return;
  }
  openBatteryTwinAgent();
  prepAgentNote(`Reading paper URL to fill source-page metadata gaps: ${url}. I will only replace missing or weaker fields with paper-supported evidence.`);
  setPrepBusy(true);
  try {
    metadataPaperExtraction = await fetchMetadataExtraction(url, 'paper');
    currentMetadataExtraction = mergeMetadataExtractions(metadataSourceExtraction, metadataPaperExtraction);
    resetMetadataConfirmation();
    renderMetadataResult(currentMetadataExtraction);
    const missing = summarizeMetadataMissing(currentMetadataExtraction);
    prepToast(missing.length ? `${missing.length} fields still need manual missing status.` : 'Paper evidence filled the tracked metadata fields.');
    prepAgentNote(missing.length
      ? `Paper check finished. Fields still not stated: ${missing.join(', ')}. You can confirm them as missing if that is acceptable.`
      : 'Paper check finished. Review the merged metadata and confirm the rows before downloading.');
  } catch (error) {
    prepToast(error.message || 'Could not extract paper metadata.');
    prepAgentNote('Paper URL metadata extraction failed. Check that app.py is running and the paper URL is reachable.');
  } finally {
    setPrepBusy(false);
  }
}

async function runMetadataExtractionDraft() {
  await runMetadataSourceCheck();
}

function summarizeMetadataMissing(data) {
  const fields = (data?.fields || []).filter(isMetadataMissing).map(row => row.field);
  const box = document.getElementById('metadataMissingSummary');
  if (box) {
    if (!data?.fields?.length) {
      box.textContent = 'No metadata check has been run yet.';
      box.classList.remove('show');
    } else if (fields.length) {
      box.innerHTML = `<strong>${fields.length} fields need paper evidence or manual missing confirmation:</strong> ${esc(fields.join(', '))}`;
      box.classList.add('show');
    } else {
      box.innerHTML = '<strong>No missing tracked fields.</strong> Review the evidence and confirm the metadata before downloading.';
      box.classList.add('show');
    }
  }
  return fields;
}

function updateMetadataDownloadState() {
  const button = document.getElementById('metadataDownloadBtn');
  const fields = currentMetadataExtraction?.fields || [];
  const confirmedRows = fields.filter(row => row.confirmed);
  if (button) button.disabled = !(metadataFinalConfirmed && confirmedRows.length);
}

function toggleMetadataFinalConfirmation() {
  metadataFinalConfirmed = Boolean(document.getElementById('metadataConfirmAll')?.checked);
  updateMetadataDownloadState();
}

function toggleMetadataRow(fieldName, checked) {
  const row = (currentMetadataExtraction?.fields || []).find(item => item.field === fieldName);
  if (row) row.confirmed = Boolean(checked);
  updateMetadataDownloadState();
}

function updateMetadataValue(fieldName, value) {
  const row = (currentMetadataExtraction?.fields || []).find(item => item.field === fieldName);
  if (!row) return;
  row.value = value;
  row.status = value && value !== METADATA_MISSING_VALUE ? 'found' : 'missing';
  resetMetadataConfirmation();
  renderMetadataResult(currentMetadataExtraction);
}

function renderMetadataResult(data) {
  const panel = document.getElementById('metadataResultPanel');
  const body = document.getElementById('metadataResultBody');
  const confirmBox = document.getElementById('metadataConfirmBox');
  const subtitle = document.getElementById('metadataResultSubtitle');
  if (!panel || !body) return;
  const rows = data.fields || [];
  body.innerHTML = rows.map(row => {
    const missing = isMetadataMissing(row);
    const confidence = metadataConfidence(row);
    const sourceType = row.source_type || data.source_type || 'source';
    const field = esc(row.field || '');
    return `<tr>
      <td><input type="checkbox" ${row.confirmed ? 'checked' : ''} onchange="toggleMetadataRow('${field}', this.checked)" aria-label="Confirm ${field}"></td>
      <td>${field}</td>
      <td class="${missing ? 'missing' : ''}"><input class="metadata-value-input" value="${esc(row.value || '')}" onchange="updateMetadataValue('${field}', this.value)"></td>
      <td>${esc(row.evidence || '')}</td>
      <td><span class="metadata-source-badge">${esc(sourceType)}</span></td>
      <td>${Math.round(confidence * 100)}%</td>
    </tr>`;
  }).join('');
  panel.classList.add('show');
  confirmBox?.classList.add('show');
  const missing = summarizeMetadataMissing(data);
  if (subtitle) {
    subtitle.textContent = missing.length
      ? 'Use a paper URL for missing fields, or confirm that they are not stated.'
      : 'Review each value and confirm the rows before downloading.';
  }
  updateMetadataDownloadState();
}

function downloadMetadataCsv() {
  if (!currentMetadataExtraction?.fields?.length) {
    prepToast('Generate a metadata draft first.');
    return;
  }
  const rows = currentMetadataExtraction.fields.filter(row => row.confirmed);
  if (!rows.length || !metadataFinalConfirmed) {
    prepToast('Confirm metadata rows and check the final review box before downloading.');
    return;
  }
  const header = ['field', 'value', 'evidence', 'confidence', 'status', 'source_type'];
  const lines = [header.join(',')].concat(rows.map(row =>
    header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')
  ));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'dataset_metadata.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  prepToast('Confirmed metadata CSV downloaded.');
}

function normalizePrepFieldName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findPrepAIField(sourceField) {
  const normalized = normalizePrepFieldName(sourceField.name || sourceField.label);
  return prepAIFields.find(field =>
    field.aliases.some(alias => normalizePrepFieldName(alias) === normalized) ||
    normalized.includes(normalizePrepFieldName(field.label))
  );
}

function updatePrepAIStateFromInspection(data) {
  const sourceFields = Array.isArray(data?.fields) ? data.fields : [];
  prepAIState = prepAIFields.map(field => {
    const matched = sourceFields.find(item => findPrepAIField(item)?.key === field.key);
    if (!matched) {
      return {
        ...field,
        value: '',
        evidence: 'The AI did not find reliable source evidence for this field.',
        confidence: 0,
        confirmed: false,
        pending: true
      };
    }
    return {
      ...field,
      value: matched.pending ? '' : String(matched.value || ''),
      evidence: String(matched.evidence || 'Detected by AI inspection.'),
      confidence: Number(matched.confidence || 0),
      confirmed: false,
      pending: Boolean(matched.pending) || !matched.value
    };
  });
  renderAIFieldTable();
}

function prepConfirmedRefName() {
  const parts = prepAIState
    .filter(field => field.confirmed && ['year', 'source_lab', 'chemistry', 'form_factor', 'c_rate', 'temperature'].includes(field.key))
    .map(field => String(field.value || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''))
    .filter(Boolean);
  return parts.length ? parts.join('_') : 'UNKNOWN_UNKNOWN_UNKNOWN_UNKNOWN';
}

function renderAIFieldTable() {
  const root = document.getElementById('aiFieldTable');
  if (!root) return;
  root.innerHTML = prepAIState.map(field => {
    const score = Math.max(0, Math.min(100, Math.round(Number(field.confidence || 0) * 100)));
    const confClass = score >= 85 ? 'high' : score >= 60 ? 'med' : score > 0 ? 'low' : 'none';
    const displayValue = field.value || 'Unknown';
    return `
      <div class="ai-field-row ${field.confirmed ? 'is-confirmed' : 'is-pending'}">
        <div class="ai-field-meta">
          <div class="ai-field-label">${esc(field.label)}</div>
          <span class="ai-status ${field.confirmed ? 'ok' : 'warn'}">${field.confirmed ? 'Confirmed' : 'Needs confirmation'}</span>
        </div>
        <div>
          <div class="ai-field-mini">Detected value</div>
          <div class="ai-field-value">${field.value ? esc(displayValue) : '<em>Unknown</em>'}</div>
        </div>
        <div>
          <div class="ai-field-mini">Source evidence</div>
          <div class="ai-field-ev">${esc(field.evidence || 'No inspection yet')}</div>
        </div>
        <div>
          <div class="ai-field-mini">Confidence</div>
          <div class="ai-conf ${confClass}"><span class="ai-conf-bar"><span style="width:${score}%"></span></span><span class="ai-conf-num">${score ? score + '%' : '-'}</span></div>
        </div>
        <div class="ai-field-actions">
          <input class="ai-field-override" data-ai-field="${esc(field.key)}" value="${esc(field.value || '')}" placeholder="Override or type value" oninput="overridePrepAIField(this)">
          <button type="button" class="prep-btn ${field.confirmed ? 'ai-btn-unconfirm' : 'ai-btn-confirm'}" onclick="togglePrepAIConfirm('${field.key}', ${field.confirmed ? 'false' : 'true'})">${field.confirmed ? 'Mark Unknown' : 'Confirm'}</button>
        </div>
      </div>`;
  }).join('');
  const confirmed = prepAIState.filter(field => field.confirmed).length;
  const summary = document.getElementById('aiInspectSummary');
  if (summary) summary.textContent = `${confirmed} / ${prepAIState.length} fields confirmed`;
  const refName = prepConfirmedRefName();
  const refPreview = document.getElementById('aiRefNamePreview');
  if (refPreview) refPreview.textContent = refName;
  const refTarget = document.getElementById('skillRefName');
  const packageTarget = document.getElementById('skillPackageName');
  if (refTarget) refTarget.textContent = refName;
  if (packageTarget) packageTarget.textContent = `bt_skill_${refName}`;
}

function resetPrepSummary() {
  const summary = document.querySelector('#analysisPanel .analysis-summary');
  if (!summary) return;
  summary.innerHTML = `
    <div class="summary-main"><span class="summary-icon">AI</span><span><span class="summary-title">Waiting for inspection</span><span class="summary-sub">Choose files or enter a local path, then run AI inspection.</span></span></div>
    <div class="summary-stat"><strong>0 / ${prepAIState.length}</strong><span>fields inferred</span></div>
    <div class="summary-stat"><strong>${prepAIState.length}</strong><span>need confirmation</span></div>
    <div class="summary-stat"><strong>-</strong><span>overall confidence</span></div>`;
}

function overridePrepAIField(input) {
  const key = input.getAttribute('data-ai-field');
  prepAIState = prepAIState.map(field => field.key === key
    ? { ...field, value: input.value.trim(), confirmed: false, pending: !input.value.trim() }
    : field);
  renderAIFieldTable();
}

function togglePrepAIConfirm(key, confirmed) {
  prepAIState = prepAIState.map(field => {
    if (field.key !== key) return field;
    const input = document.querySelector(`.ai-field-override[data-ai-field="${key}"]`);
    const nextValue = input ? input.value.trim() : field.value;
    return { ...field, value: nextValue, confirmed: Boolean(confirmed && nextValue), pending: !nextValue };
  });
  renderAIFieldTable();
}

async function requestInspection(url, options) {
  setPrepBusy(true);
  openBatteryTwinAgent();
  prepAgentNote('I am inspecting the uploaded raw battery data now: structure, file names, headers, units, sample rows, and BatteryTwin schema clues.');
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    if (!response.ok) throw new Error(data.error || `Inspection backend unavailable (${response.status})`);
    currentInspectionManifest = data;
    renderInspectionResult(data);
    updatePrepAIStateFromInspection(data);
    const aiNote = data.ai_status?.used
      ? ` App AI added ${data.ai_status.accepted_fields || 0} evidence-backed field(s).`
      : ` ${data.ai_status?.reason || ''}`;
    prepToast(`Real inspection complete.${aiNote}`);
    prepAgentNote(`Inspection complete. I inferred ${data.inferred_count || 0} field(s), left ${data.pending_count || 0} for confirmation, and prepared the BatteryTwin skill context from confirmed evidence only.`);
    showPrepStage(2);
  } catch (error) {
    const data = buildInspectionFallback(url, options, error);
    currentInspectionManifest = data;
    renderInspectionResult(data);
    updatePrepAIStateFromInspection(data);
    prepToast('Backend unavailable. Showing conservative file-role inspection.');
    prepAgentNote('I could not complete the inspection through the local backend, so I classified files conservatively from names and extensions. Metadata-only files still cannot generate timeseries.csv or cycle_summary.csv.');
    showPrepStage(2);
  } finally {
    setPrepBusy(false);
  }
}

function buildInspectionFallback(url, options, error) {
  const input = document.getElementById('prepFileInput');
  const files = getQueuedPrepFiles(input);
  const path = cleanPrepPath(document.getElementById('prepPath')?.value);
  const listedFiles = files.length
    ? files.map(file => classifyPrepFile(file._batteryTwinPath || file.webkitRelativePath || file.name))
    : [classifyPrepFile(path || 'local path')];
  const measurementCount = listedFiles.filter(file => file.file_role === 'measurement_data').length;
  const metadataCount = listedFiles.filter(file => file.file_role === 'metadata_only').length;
  const fields = [
    {
      name: 'Data format',
      value: files.length ? summarizePrepExtensions(files) : inferPrepPathFormat(path),
      evidence: files.length ? 'Derived from queued file extensions.' : 'Derived from the local path text.',
      confidence: files.length || path ? 0.7 : 0,
      pending: !(files.length || path)
    },
    {
      name: 'Cell count',
      value: measurementCount ? String(measurementCount) : '',
      evidence: measurementCount ? 'One measurement-like source file is treated as one tentative cell until the backend inspects the raw contents.' : 'No measurement-like files were detected.',
      confidence: measurementCount ? 0.45 : 0,
      pending: !measurementCount
    },
    {
      name: 'Source / lab',
      value: '',
      evidence: 'Not available from filenames alone. Check the source page, README, paper, or supplementary files.',
      confidence: 0,
      pending: true
    },
    {
      name: 'Chemistry',
      value: '',
      evidence: 'Not inferred from dataset name or common battery models.',
      confidence: 0,
      pending: true
    },
    {
      name: 'Form factor',
      value: '',
      evidence: 'Not inferred from filename patterns; source evidence is required.',
      confidence: 0,
      pending: true
    },
    {
      name: 'C-rate',
      value: '',
      evidence: 'Not guessed without stated protocol or measurable nominal capacity/current evidence.',
      confidence: 0,
      pending: true
    },
    {
      name: 'Temperature',
      value: '',
      evidence: 'Not guessed from common experiment settings.',
      confidence: 0,
      pending: true
    },
    {
      name: 'Year',
      value: '',
      evidence: 'Not available from browser-side inspection.',
      confidence: 0,
      pending: true
    },
    {
      name: 'License',
      value: '',
      evidence: 'Use Task 2 source-page metadata or paper evidence to confirm the license.',
      confidence: 0,
      pending: true
    }
  ];
  return {
    status: 'frontend_fallback',
    message: error?.message || 'Inspection backend unavailable.',
    file_count: listedFiles.length,
    sampled_count: 0,
    inferred_count: fields.filter(field => !field.pending).length,
    pending_count: fields.filter(field => field.pending).length,
    overall_confidence: measurementCount ? 0.32 : 0.1,
    files: listedFiles,
    fields,
    ai_status: { used: false, reason: 'Frontend fallback; backend app.py routes are unavailable.' },
    audit: {
      missing_percent: measurementCount ? 75 : 100,
      anomalies: 0,
      unit_conversions: 0,
      unmapped_fields: metadataCount
    },
    mappings: {}
  };
}

function classifyPrepFile(name) {
  const filename = String(name || '').trim() || 'local path';
  const lower = filename.toLowerCase();
  const ext = (lower.match(/\.([a-z0-9]+)$/) || [,''])[1];
  const metadataOnly = ['pdf', 'html', 'htm', 'md', 'ris', 'bib'];
  const measurement = ['csv', 'xlsx', 'xls', 'mat', 'json', 'parquet', 'txt', 'tsv', 'h5', 'hdf5'];
  if (metadataOnly.includes(ext) || /readme|datacite|citation|paper|license|metadata/.test(lower)) {
    return {
      filename,
      file_role: 'metadata_only',
      role_reason: 'DataCite JSON, README files, paper PDFs, webpage HTML, and similar evidence files are metadata-only unless raw measurements are present.'
    };
  }
  if (measurement.includes(ext)) {
    return {
      filename,
      file_role: 'measurement_data',
      role_reason: 'Extension is compatible with raw battery measurement inspection; confirm voltage/current/time/cycle fields before conversion.'
    };
  }
  return {
    filename,
    file_role: 'unknown',
    role_reason: 'The browser cannot verify this path or folder contents without the local inspection backend.'
  };
}

function summarizePrepExtensions(files) {
  const extensions = Array.from(new Set(files.map(file => {
    const name = file._batteryTwinPath || file.webkitRelativePath || file.name || '';
    return (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [,'unknown'])[1].toUpperCase();
  }))).filter(Boolean);
  return extensions.join(' + ') || 'Unknown';
}

function inferPrepPathFormat(path) {
  const ext = (String(path || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [,'folder/path'])[1];
  return ext === 'folder/path' ? 'Folder or local path' : ext.toUpperCase();
}

function runPrepInspection() {
  const pathInput = document.getElementById('prepPath');
  const path = cleanPrepPath(pathInput?.value);
  if (pathInput && pathInput.value !== path) pathInput.value = path;
  if (!path) {
    prepToast('Enter a real local file or folder path.');
    return;
  }
  requestInspection('http://127.0.0.1:8000/api/inspect-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
}

function cleanPrepPath(value) {
  return String(value || '').trim().replace(/^["']+|["']+$/g, '');
}

function runPrepFileInspection() {
  const input = document.getElementById('prepFileInput');
  const files = getQueuedPrepFiles(input);
  if (!files.length) {
    const path = cleanPrepPath(document.getElementById('prepPath')?.value);
    if (path) {
      runPrepInspection();
      return;
    }
    input?.click();
    prepToast('Choose raw files, drop a folder, or paste a real local path first.');
    return;
  }
  const form = new FormData();
  files.forEach(file => form.append('files', file, file._batteryTwinPath || file.webkitRelativePath || file.name));
  prepAgentNote(`Uploading ${files.length} queued file(s) to the local inspection backend now.`);
  requestInspection('http://127.0.0.1:8000/api/inspect', { method: 'POST', body: form });
}

function getQueuedPrepFiles(input = document.getElementById('prepFileInput')) {
  return Array.from(prepDroppedFiles || input?.files || []);
}

function updatePrepFileNote(files) {
  const dropZone = document.getElementById('prepDropZone');
  const selected = document.getElementById('prepSelectedFiles');
  if (!files.length) {
    dropZone?.classList.remove('has-files');
    if (selected) {
      selected.classList.remove('has-files');
      selected.innerHTML = '<span>No files queued.</span>';
    }
    return;
  }
  dropZone?.classList.add('has-files');
  if (selected) {
    const names = files.slice(0, 3).map(file => file._batteryTwinPath || file.webkitRelativePath || file.name).join(', ');
    const more = files.length > 3 ? `, +${files.length - 3} more` : '';
    selected.classList.add('has-files');
    selected.innerHTML = `<span>Queued: ${esc(names + more)}</span><button class="prep-clear-files" type="button" onclick="clearPrepQueuedFiles(event)">Clear</button>`;
  }
  prepAgentNote(`I have ${files.length} raw file(s) queued for BatteryTwin inspection. Click Run AI inspection when ready.`);
}

function handlePrepFileInput(event) {
  const files = Array.from(event?.target?.files || []);
  prepDroppedFiles = files.length ? files : null;
  updatePrepFileNote(files);
  if (files.length) prepToast(`${files.length} file(s) queued for AI inspection.`);
}

function clearPrepQueuedFiles(event) {
  event?.preventDefault();
  event?.stopPropagation();
  prepDroppedFiles = null;
  const input = document.getElementById('prepFileInput');
  if (input) input.value = '';
  const folderInput = document.getElementById('prepFolderInput');
  if (folderInput) folderInput.value = '';
  updatePrepFileNote([]);
  prepToast('Queued files cleared.');
}

function renderInspectionResult(data) {
  const summary = document.querySelector('#analysisPanel .analysis-summary');
  if (summary) {
    const aiLabel = data.ai_status?.used ? 'local + app AI' : 'local inspection';
    summary.innerHTML = `
      <div class="summary-main"><span class="summary-icon">✓</span><span><span class="summary-title">Inspection complete</span><span class="summary-sub">${data.file_count} files · ${data.sampled_count} sampled · ${aiLabel}</span></span></div>
      <div class="summary-stat"><strong>${data.inferred_count} / ${data.fields.length}</strong><span>fields inferred</span></div>
      <div class="summary-stat"><strong>${data.pending_count}</strong><span>need confirmation</span></div>
      <div class="summary-stat"><strong>${Number(data.overall_confidence).toFixed(2)}</strong><span>overall confidence</span></div>`;
  }
  renderFileRolePanel(data.files || []);
  const tbody = document.querySelector('#analysisPanel .evidence-table tbody');
  if (tbody) tbody.innerHTML = data.fields.map(field => {
    const score = Math.round(Number(field.confidence || 0) * 100);
    const pending = field.pending ? ' pending' : '';
    return `<tr><td class="evidence-field">${esc(field.name)}</td>
      <td class="evidence-value${pending}">${esc(field.value)}</td>
      <td class="evidence-source">${esc(field.evidence)}</td>
      <td><span class="confidence${score < 60 ? ' medium' : ''}${pending}" style="--score:${score}%">${score}%</span></td>
      <td><button class="field-edit" onclick="editPrepField(this)">${field.pending ? 'Confirm' : 'Edit'}</button></td></tr>`;
  }).join('');
  const audit = document.querySelector('.audit-strip');
  if (audit && data.audit) {
    audit.innerHTML = `<div class="audit-item"><strong>${data.audit.missing_percent}%</strong><span>missing values in sample</span></div>
      <div class="audit-item"><strong>${data.audit.anomalies}</strong><span>sample anomalies flagged</span></div>
      <div class="audit-item"><strong>${data.audit.unit_conversions}</strong><span>unit conversions suggested</span></div>
      <div class="audit-item"><strong>${data.audit.unmapped_fields}</strong><span>unmapped source fields</span></div>`;
  }
  const activeType = data.fields.find(field => field.name === 'Dataset type' && !field.pending)?.value;
  if (activeType) {
    document.querySelectorAll('.type-tab').forEach(tab => {
      const keyword = tab.textContent.trim().split(' ')[0].toLowerCase();
      tab.classList.toggle('active', activeType.toLowerCase().includes(keyword));
    });
  }
  const mapping = data.mappings || {};
  document.querySelectorAll('.channel-card').forEach(card => {
    const name = card.querySelector('.channel-name')?.textContent.trim();
    const state = card.querySelector('.channel-state');
    if (!state || !(name in mapping)) return;
    state.textContent = mapping[name] ? `Mapped · ${mapping[name]}` : 'Not found · may remain empty';
    card.classList.toggle('optional', !mapping[name]);
  });
  const safeParts = data.fields
    .filter(field => !field.pending && ['Year', 'Source / lab', 'Chemistry', 'Form factor'].includes(field.name))
    .map(field => String(field.value).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, ''))
    .filter(Boolean);
  const refName = safeParts.join('_') || 'pending_confirmed_context';
  const refTarget = document.getElementById('skillRefName');
  const packageTarget = document.getElementById('skillPackageName');
  if (refTarget) refTarget.textContent = refName;
  if (packageTarget) packageTarget.textContent = `bt_skill_${refName}`;
}

function renderFileRolePanel(files) {
  const panel = document.getElementById('fileRolePanel');
  if (!panel) return;
  if (!files.length) {
    panel.innerHTML = '<div class="file-role-card unknown"><strong>No files classified yet</strong><span>Upload raw data for Task 1 or provide a source URL for Task 2.</span></div>';
    return;
  }
  const labels = {
    measurement_data: ['measurement', 'Raw measurement data', 'Can be used for Task 1 conversion if voltage/current/time/cycle fields are mapped.'],
    metadata_only: ['metadata', 'Metadata-only evidence', 'Use for Task 2 metadata extraction; it cannot generate timeseries or cycle_summary by itself.'],
    unknown: ['unknown', 'Unknown file role', 'Needs review before assigning to Task 1 or Task 2.']
  };
  panel.innerHTML = files.slice(0, 6).map(file => {
    const role = file.file_role || 'unknown';
    const [klass, title, fallback] = labels[role] || labels.unknown;
    const reason = file.role_reason || fallback;
    return `<div class="file-role-card ${klass}"><strong>${esc(title)}</strong><span>${esc(file.filename || 'file')} - ${esc(reason)}</span></div>`;
  }).join('');
}

function editPrepField(button) {
  const row = button.closest('tr');
  const valueCell = row && row.querySelector('.evidence-value');
  if (!valueCell) return;
  const current = valueCell.classList.contains('pending') ? '' : valueCell.textContent.trim();
  const updated = window.prompt('Confirm or edit this value. Leave blank to keep it pending.', current);
  if (updated === null) return;
  if (updated.trim()) {
    valueCell.textContent = updated.trim();
    valueCell.classList.remove('pending');
    button.textContent = 'Edit';
    prepToast('Value confirmed and marked as user-reviewed.');
  } else {
    valueCell.textContent = 'Needs confirmation';
    valueCell.classList.add('pending');
    button.textContent = 'Confirm';
  }
}

function downloadPrepManifest() {
  const manifest = currentInspectionManifest || {
    workflow: 'evidence-first',
    dataset_type: { value: 'calendar aging', confidence: 0.96, evidence: ['storage_25C folders', 'periodic RPT blocks'] },
    inferred_fields: 9,
    pending_fields: ['c_rate', 'license'],
    schema_compliant: true,
    soh_rul_benchmark_eligible: false,
    extended_channels: ['dT_dt_C_per_s', 'storage_time_h'],
    validation: {
      schema: 'readable',
      context: 'generate_draft_from_source_evidence',
      validator: 'fallback_to_builtin_and_log_reason',
      existing_outputs: 'archive_before_write'
    }
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'batterytwin_inspection_manifest.json';
  link.click();
  URL.revokeObjectURL(link.href);
  prepToast('Inspection manifest exported.');
}

function generatePrepSkill() {
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
    window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'preprocessing_skill' });
  }
  prepToast('Skill plan confirmed — package is ready to generate.');
}

async function readPrepDropEntry(entry, prefix = '') {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file(file => {
        file._batteryTwinPath = prefix + file.name;
        resolve([file]);
      }, () => resolve([]));
    });
  }
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const batches = [];
  let batch = [];
  do {
    batch = await new Promise(resolve => reader.readEntries(resolve, () => resolve([])));
    batches.push(...batch);
  } while (batch.length);
  const nested = await Promise.all(batches.map(item => readPrepDropEntry(item, `${prefix}${entry.name}/`)));
  return nested.flat();
}

async function collectPrepDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const nested = await Promise.all(entries.map(entry => readPrepDropEntry(entry)));
    return nested.flat();
  }
  return Array.from(dataTransfer?.files || []);
}

const prepDropZone = document.getElementById('prepDropZone');
if (prepDropZone) {
  ['dragenter', 'dragover'].forEach(type => {
    prepDropZone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      prepDropZone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    prepDropZone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      if (type === 'dragleave' && prepDropZone.contains(event.relatedTarget)) return;
      prepDropZone.classList.remove('dragging');
    });
  });
  prepDropZone.addEventListener('drop', async event => {
    const files = await collectPrepDroppedFiles(event.dataTransfer);
    prepDroppedFiles = files;
    updatePrepFileNote(files);
    if (!files.length) prepToast('No files were dropped.');
  });
}

document.querySelectorAll('.type-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    tab.parentElement.querySelectorAll('.type-tab').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    prepToast(`${tab.textContent.trim()} requirements selected.`);
  });
});

/* ── PREPROCESSING WIZARD ── */
var PP = { step: 0 };
function ppPanels() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-step-panel')); }
function ppSteps() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-step')); }
function ppChecks(panel) { return Array.from(panel.querySelectorAll('.pp-check')); }
function ppStepDone(index) {
  const panel = ppPanels()[index];
  if (!panel) return false;
  const checks = ppChecks(panel);
  return checks.length > 0 && checks.every(c => c.classList.contains('done'));
}
function ppMaxUnlocked() {
  let max = 0;
  const panels = ppPanels();
  for (let i = 0; i < panels.length; i++) {
    if (ppStepDone(i)) max = Math.min(i + 1, panels.length - 1);
    else break;
  }
  return max;
}
function ppRender() {
  const panels = ppPanels();
  const steps = ppSteps();
  if (!panels.length || !steps.length) return;
  const maxUnlocked = ppMaxUnlocked();
  if (PP.step > maxUnlocked) PP.step = maxUnlocked;
  panels.forEach((panel, i) => panel.classList.toggle('active', i === PP.step));
  steps.forEach((step, i) => {
    const done = ppStepDone(i);
    const locked = i > maxUnlocked;
    step.classList.toggle('active', i === PP.step);
    step.classList.toggle('done', done);
    step.classList.toggle('locked', locked);
    step.disabled = locked;
    const num = step.querySelector('.pp-step-num');
    if (num) num.textContent = done ? '✓' : String(i + 1);
  });
  const active = panels[PP.step];
  const activeDone = ppStepDone(PP.step);
  const doneCount = document.querySelectorAll('#page-preprocessing .pp-check.done').length;
  const totalCount = document.querySelectorAll('#page-preprocessing .pp-check').length;
  const render = document.getElementById('pp-render');
  const doneEl = document.getElementById('pp-done-count');
  const gate = document.getElementById('pp-gate');
  if (render) render.textContent = 'Step ' + (PP.step + 1) + ' of ' + panels.length;
  if (doneEl) doneEl.textContent = doneCount + '/' + totalCount;
  if (gate) gate.textContent = doneCount === totalCount ? 'Ready' : (activeDone ? 'Open' : 'Locked');
  ppUpdatePackagePreview();
  if (active) {
    const prev = active.querySelector('.pp-actions .pp-btn:not(.pp-next)');
    const next = active.querySelector('.pp-next');
    if (prev) prev.disabled = PP.step === 0;
    if (next) {
      next.disabled = !activeDone;
      next.textContent = PP.step === panels.length - 1 ? 'Finish' : 'Next';
    }
  }
}
function ppGoStep(index) {
  if (index > ppMaxUnlocked()) {
    showToast('Complete the current preprocessing checks before moving on.', 'info');
    return;
  }
  PP.step = Math.max(0, Math.min(index, ppPanels().length - 1));
  ppRender();
}
function ppToggleCheck(el) {
  el.classList.toggle('done');
  el.setAttribute('aria-pressed', el.classList.contains('done') ? 'true' : 'false');
  ppRender();
}
function ppNext() {
  if (!ppStepDone(PP.step)) {
    showToast('Mark every check in this step before continuing.', 'info');
    return;
  }
  if (PP.step < ppPanels().length - 1) {
    PP.step++;
    ppRender();
  } else {
    showToast('Preprocessing package is ready for Benchmark.', 'success');
  }
}
function ppPrev() {
  PP.step = Math.max(0, PP.step - 1);
  ppRender();
}

/* ── PREPROCESSING INSPECT-FIRST GUIDE ── */
var PP_STAGE = { step: 0 };
function ppStagePanels() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-two-stage .pp-stage')); }
function ppStageButtons() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-guide-step')); }
function ppUpdateInspectCommand() {
  const formatEl = document.getElementById('pp2-source-format');
  const command = document.getElementById('pp2-inspect-command');
  const format = formatEl ? formatEl.value : 'csv_folder';
  if (!command) return;
  command.textContent = [
    'cd /path/to/cell_files_folder',
    'python3 inspect_batterylake_titles.py \\',
    '  --format ' + format + ' \\',
    '  --schema-out raw_schema.json \\',
    '  --columns-out raw_columns.csv'
  ].join('\n');
}
function ppStageRender() {
  const panels = ppStagePanels();
  const buttons = ppStageButtons();
  if (!panels.length) return;
  PP_STAGE.step = Math.max(0, Math.min(PP_STAGE.step, panels.length - 1));
  panels.forEach((panel, i) => panel.classList.toggle('active', i === PP_STAGE.step));
  buttons.forEach((button, i) => {
    button.classList.toggle('active', i === PP_STAGE.step);
    button.classList.toggle('done', i < PP_STAGE.step);
    const num = button.querySelector('.pp-guide-step-num');
    if (num) num.textContent = i < PP_STAGE.step ? '✓' : String(i + 1);
  });
  const prev = document.getElementById('pp2-prev-step');
  const next = document.getElementById('pp2-next-step');
  const position = document.getElementById('pp2-stage-position');
  if (prev) prev.disabled = PP_STAGE.step === 0;
  if (next) next.textContent = PP_STAGE.step === panels.length - 1 ? 'Finish' : 'Next';
  if (position) position.textContent = 'Step ' + (PP_STAGE.step + 1) + ' of ' + panels.length;
  ppUpdateInspectCommand();
}
function ppStageGo(index) {
  PP_STAGE.step = Number(index) || 0;
  ppStageRender();
}
function ppStageNext() {
  const panels = ppStagePanels();
  if (PP_STAGE.step < panels.length - 1) {
    PP_STAGE.step++;
    ppStageRender();
  }
}
function ppStagePrev() {
  PP_STAGE.step = Math.max(0, PP_STAGE.step - 1);
  ppStageRender();
}
async function ppCopyText(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showToast(successMessage || 'Copied.', 'success');
  } catch (_) {
    showToast('Copy failed. Select the command block manually.', 'error');
  }
}
function ppCopyInspectCommand() {
  const cmd = (document.getElementById('pp2-inspect-command') || {}).textContent || '';
  ppCopyText(cmd.trim(), 'Inspect command copied.');
}

async function copyTermsBibTeX() {
  const block = document.getElementById('terms-bibtex');
  const btn = document.getElementById('terms-copy-btn');
  const text = block ? block.textContent.replace(/^\n+/, '').replace(/\n+$/, '') : '';
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    if (btn) {
      const previous = btn.textContent;
      btn.textContent = 'Copied';
      clearTimeout(copyTermsBibTeX._timer);
      copyTermsBibTeX._timer = setTimeout(() => {
        btn.textContent = previous || 'Copy BibTeX';
      }, 1600);
    }
  } catch (_) {
    showToast('Copy failed. Select the BibTeX block manually.', 'error');
  }
}
window.copyTermsBibTeX = copyTermsBibTeX;

/* ── PAGE NAVIGATION ── */
var pendingInitialModelId = null;
window.mlLibraryReady = false;
function showPage(name, navEl, options = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  if (name === 'preprocessing') {
    if (typeof showPrepStage === 'function') showPrepStage(prepStage || 1);
    if (typeof renderAIFieldTable === 'function') renderAIFieldTable();
    ppRender();
    ppStageRender();
  }
  if (name === 'quality' && !options.skipQualityLoad && typeof ensureQualityPageReady === 'function') {
    void ensureQualityPageReady(options.qualityDatasetId || null);
  }
  if (!options.preserveHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (!options.deferPageView && window.BatteryLakeAnalytics &&
      typeof window.BatteryLakeAnalytics.trackPageView === 'function') {
    window.BatteryLakeAnalytics.trackPageView();
  }
}
window.showPage = showPage;

function applyInitialPageFromHash() {
  const name = (location.hash || '').replace(/^#/, '');
  if (name.startsWith('datasets-')) {
    const cat = getCategoryFromSlug(name.replace(/^datasets-/, ''));
    if (cat) {
      allDatasetsApplied = false;
      activeChems.clear();
      activeForms.clear();
      activeCategories.clear();
      activeCategories.add(cat);
      activeDomains.clear();
      activeDuties.clear();
      syncPendingFromActive();
      renderAppliedFilterChips();
      showPage('datasets', document.getElementById('nav-datasets'), {
        preserveHash: true,
        deferPageView: true
      });
      history.replaceState(null, '', '#datasets');
      if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackPageView === 'function') {
        window.BatteryLakeAnalytics.trackPageView();
      }
      filterDatasets();
      return;
    }
  }
  if (name.startsWith('model-')) {
    const modelId = name.replace(/^model-/, '');
    pendingInitialModelId = modelId;
    if (window.mlLibraryReady && typeof renderModelDetailsPage === 'function') {
      renderModelDetailsPage(modelId);
      showPage('model-details', document.getElementById('nav-models'), { preserveHash: true });
    }
    return;
  }
  if (name.startsWith('quality-') || name.startsWith('quality/')) {
    const datasetId = name.replace(/^quality[-/]/, '');
    showPage('quality', document.querySelector('.sidebar-nav a[onclick*="quality"]'), {
      preserveHash: true,
      qualityDatasetId: datasetId || null
    });
    history.replaceState(null, '', datasetId ? '#quality-' + datasetId : '#quality');
    return;
  }
  if (!name || !document.getElementById('page-' + name)) {
    showPage('home', document.getElementById('nav-home'));
    return;
  }
  showPage(name, document.querySelector('.sidebar-nav a[onclick*="' + name + '"]'));
}
window.addEventListener('hashchange', applyInitialPageFromHash);

const BW = { page: 1, pageSize: 6, selId: null, splitMode: 'manual', ratio: { train: 60, val: 20, test: 20 }, split: { train: [], val: [], test: [], excluded: [] }, f: { chem:'', form:'', inst:'', temp:'', q:'' } };
let bwHasRun = false;
let bwPackageExported = false;

const PP_TS_COLUMNS = ['cell_id','cycle_id','time_s','voltage_V','current_A','temperature_C','charge_capacity_Ah','discharge_capacity_Ah','step_type'];
const PP_CYCLE_COLUMNS = ['cell_id','cycle_id','step_type','capacity_Ah','SOH','RUL','charge_capacity_Ah','discharge_capacity_Ah','temperature_max_C','temperature_avg_C','charge_duration_s','discharge_duration_s','internal_resistance_Ohm','cycle_end_flag'];
const PP_METADATA_COLUMNS = ['dataset_id','cell_id','source_type','split_tag','chemistry','cathode_material','anode_material','brand_or_manufacturer','model_or_size','form_factor','nominal_capacity_Ah','nominal_voltage_V','temperature_C','charge_protocol','discharge_protocol','C_rate','cutoff_voltage_upper','cutoff_voltage_lower'];
const PP_ADAPTERS = [
  { key: 'batteryarchive_csv', name: 'BatteryArchive CSV', requiresMat: false },
  { key: 'generic_csv_ranges', name: 'Generic CSV + cycle ranges', requiresMat: false },
  { key: 'matlab_mat', name: 'MATLAB MAT', requiresMat: true }
];

function ppPackageName(adapterKey, datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_preprocess_' + adapterKey + '_' + (base || 'battery_dataset');
}

function ppInspectPackageName(sourceFormat, datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_inspect_' + (sourceFormat || 'raw') + '_' + (base || 'battery_dataset');
}

function ppSkillPackageName(datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_skill_' + (base || 'battery_dataset');
}

function ppSkillRootName() {
  return 'batterylake-preprocessing';
}

function ppAdapterForFormat(sourceFormat) {
  if (sourceFormat === 'matlab_mat') return 'matlab_mat';
  if (sourceFormat === 'processed_csv') return 'batteryarchive_csv';
  return 'generic_csv_ranges';
}

function ppRawSchemaFiles() {
  const schema = PP.rawSchema || {};
  return Array.isArray(schema.files) ? schema.files : [];
}

function ppRawSchemaSourceEntries() {
  const schema = PP.rawSchema || {};
  return Array.isArray(schema.source_entries) ? schema.source_entries : [];
}

function ppRawFileNames() {
  const entries = ppRawSchemaSourceEntries();
  if (entries.length) return entries.map(entry => entry.path || entry.file || '').filter(Boolean);
  return ppRawSchemaFiles().map(file => file.path || file.file || '').filter(Boolean);
}

function ppSelectedSourceFiles() {
  const select = document.getElementById('pp-source-file-select');
  if (!select) return [];
  return Array.from(select.selectedOptions || []).map(option => option.value).filter(Boolean);
}

function ppFirstRawFile() {
  const selected = ppSelectedSourceFiles();
  if (selected.length) return selected[0];
  const files = ppRawFileNames();
  return files[0] || '';
}

function ppCellIdFromSourceFile(file, index) {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  const base = parts.pop() || ('cell_' + String(index + 1).padStart(3, '0'));
  const stem = base.replace(/\.[^.]+$/, '');
  return ppNameToken(stem, 'cell_' + String(index + 1).padStart(3, '0'));
}

function ppSelectedSourceFilesLabel(files) {
  if (!files || !files.length) return 'Upload raw_schema first';
  if (files.length === 1) return files[0];
  return files.length + ' files selected';
}

function ppSchemaColumns() {
  const seen = new Set();
  const cols = [];
  ppRawSchemaFiles().forEach(file => {
    (file.columns || file.keys || []).forEach(col => {
      const name = String(col || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        cols.push(name);
      }
    });
  });
  return cols;
}

function ppGuessColumn(columns, patterns) {
  const normalized = columns.map(col => ({ raw: col, key: String(col).toLowerCase().replace(/[^a-z0-9]+/g, '') }));
  for (const pattern of patterns) {
    const found = normalized.find(item => pattern.length === 1 ? item.key === pattern : item.key.includes(pattern));
    if (found) return found.raw;
  }
  return '';
}

function ppSetSelectOptions(select, columns, guess) {
  if (!select) return;
  const opts = [''].concat(columns);
  select.innerHTML = opts.map(col => `<option value="${esc(col)}">${col ? esc(col) : 'Select source variable'}</option>`).join('');
  if (guess && columns.includes(guess)) select.value = guess;
}

function ppSelectedMapping() {
  const val = id => (document.getElementById(id) && document.getElementById(id).value) || '';
  return {
    time_s: val('pp-map-time'),
    voltage_V: val('pp-map-voltage'),
    current_A: val('pp-map-current'),
    temperature_C: val('pp-map-temperature'),
    cycle_id: val('pp-map-cycle'),
    cell_id: val('pp-map-cell')
  };
}

function ppInputVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function ppCellCount() {
  const parsed = parseInt(ppInputVal('pp2-cell-count'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function ppCellIdRule() {
  return ppInputVal('pp2-cell-id') || 'from_source_file_names';
}

function ppCellIdRuleLabel(rule) {
  const labels = {
    from_source_file_names: 'From source file names',
    from_folder_names: 'From folder names',
    inside_source_columns: 'Inside source columns',
    manual_list: 'Manual list'
  };
  return labels[rule] || labels.from_source_file_names;
}

function ppNameToken(value, fallback) {
  const clean = String(value || '').trim().replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || fallback;
}

function ppRateToken(value, fallback) {
  const clean = ppNameToken(value, fallback);
  if (/^multiC$/i.test(clean)) return 'MultiC';
  if (/C$/i.test(clean)) return clean.replace(/c$/i, 'C');
  return clean + 'C';
}

function ppTempToken(value, fallback) {
  const clean = ppNameToken(value, fallback);
  if (/^multiT$/i.test(clean)) return 'MultiT';
  if (/T$/i.test(clean)) return clean.replace(/t$/i, 'T');
  return clean + 'T';
}

function ppNamingFields() {
  return {
    year: ppNameToken(ppInputVal('pp-name-year'), 'YYYY'),
    source: ppNameToken(ppInputVal('pp-name-source'), 'SOURCE'),
    chemistry: ppNameToken(ppInputVal('pp-name-chem'), 'CHEMISTRY'),
    form_factor: ppNameToken(ppInputVal('pp-name-form'), 'FORMFACTOR'),
    charge_c_rate: ppRateToken(ppInputVal('pp-name-charge'), 'CHRG'),
    discharge_c_rate: ppRateToken(ppInputVal('pp-name-discharge'), 'DCHRG'),
    temperature: ppTempToken(ppInputVal('pp-name-temp'), 'TEMP')
  };
}

function ppGeneratedRefName() {
  const f = ppNamingFields();
  return [f.year, f.source, f.chemistry, f.form_factor, f.charge_c_rate, f.discharge_c_rate, f.temperature].join('_');
}

function ppUpdateGeneratedRefName() {
  const ref = document.getElementById('pp2-dataset-id');
  if (ref) ref.value = ppGeneratedRefName();
}

function ppCurrentConfig() {
  const sourceFormatEl = document.getElementById('pp2-source-format');
  const adapterEl = document.getElementById('pp-adapter');
  const datasetEl = document.getElementById('pp2-dataset-id') || document.getElementById('pp-dataset-id');
  const sourceFormat = sourceFormatEl ? sourceFormatEl.value : '';
  const adapter = sourceFormat ? ppAdapterForFormat(sourceFormat) : (adapterEl ? adapterEl.value : 'batteryarchive_csv');
  ppUpdateGeneratedRefName();
  const datasetId = datasetEl ? datasetEl.value.trim() : ppGeneratedRefName();
  const naming = ppNamingFields();
  const sourceFiles = ppSelectedSourceFiles();
  return {
    adapter: adapter,
    source_format: sourceFormat || adapter,
    dataset_id: datasetId || 'battery_dataset',
    cell_count: ppCellCount(),
    cell_id_rule: ppCellIdRule(),
    cell_id_rule_label: ppCellIdRuleLabel(ppCellIdRule()),
    cell_id_mode: ppCellIdRule(),
    naming: naming,
    output_root: 'outputs/processed_dataset',
    raw_schema: PP.rawSchema || null,
    source_files: sourceFiles,
    source_file: ppFirstRawFile(),
    column_mapping: ppSelectedMapping(),
    current_sign_standard: 'charge_positive_discharge_negative',
    time_series_columns: PP_TS_COLUMNS,
    cycle_summary_columns: PP_CYCLE_COLUMNS,
    metadata_columns: PP_METADATA_COLUMNS
  };
}

function ppInferDatasetIdFromRawSchema(schema) {
  const rawRoot = String((schema && schema.raw_root) || '').replace(/\\/g, '/').replace(/\/+$/g, '');
  const base = rawRoot.split('/').filter(Boolean).pop() || '';
  if (!base || base === '.' || base === '..') return '';
  return base.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

function ppMaybeSetDatasetIdFromSchema(schema) {
  const input = document.getElementById('pp2-dataset-id');
  if (!input) return;
  const current = input.value.trim();
  const inferred = ppInferDatasetIdFromRawSchema(schema);
  const canAutoFill = !current || current === 'my_raw_battery_dataset' || current === 'battery_dataset';
  if (canAutoFill && inferred) input.value = inferred;
}

function ppUpdatePackagePreview() {
  const preview = document.getElementById('pp-package-preview');
  const cfg = ppCurrentConfig();
  const name = ppPackageName(cfg.adapter, cfg.dataset_id);
  if (preview) preview.value = name;
  const preview2 = document.getElementById('pp2-convert-package-preview');
  if (preview2) preview2.value = ppSkillPackageName(cfg.dataset_id);
  const sourceFile = document.getElementById('pp2-source-file-preview');
  if (sourceFile) sourceFile.value = cfg.dataset_id;
  const scope = document.getElementById('pp-source-file-scope');
  if (scope) scope.value = cfg.source_files.length ? (cfg.source_files.length + ' selected files; one file per cell') : 'Upload raw_schema first';
}

document.addEventListener('input', e => {
  if (e.target && ['pp-adapter','pp-dataset-id','pp2-source-format','pp2-dataset-id','pp-name-year','pp-name-source','pp-name-chem','pp-name-form','pp-name-charge','pp-name-discharge','pp-name-temp','pp2-cell-id','pp2-cell-count'].includes(e.target.id)) {
    ppUpdateGeneratedRefName();
    ppUpdatePackagePreview();
    ppUpdateInspectCommand();
  }
});
document.addEventListener('change', e => {
  if (e.target && ['pp-adapter','pp-dataset-id','pp2-source-format','pp2-dataset-id','pp-name-year','pp-name-source','pp-name-chem','pp-name-form','pp-name-charge','pp-name-discharge','pp-name-temp','pp2-cell-id','pp2-cell-count','pp-source-file-select','pp-map-time','pp-map-voltage','pp-map-current','pp-map-temperature','pp-map-cycle','pp-map-cell'].includes(e.target.id)) {
    ppUpdateGeneratedRefName();
    ppUpdatePackagePreview();
    ppUpdateInspectCommand();
  }
});

function ppSchemaJson(config) {
  return JSON.stringify({
    version: 'batterylake-preprocessing-v1',
    dataset_id: config.dataset_id,
    files: {
      time_series: '*_timeseries.csv',
      cycle_summary: '*_cycle_summary.csv',
      metadata: 'dataset_metadata.csv'
    },
    columns: {
      time_series: PP_TS_COLUMNS,
      cycle_summary: PP_CYCLE_COLUMNS,
      metadata: PP_METADATA_COLUMNS
    }
  }, null, 2) + '\n';
}

function ppDatasetContextJson(config) {
  const context = {
    version: 'batterylake-agentic-preprocessing-v1',
    dataset_id: config.dataset_id,
    source_format: config.source_format,
    cell_count: config.cell_count,
    cell_id_rule: config.cell_id_rule,
    cell_id_rule_label: config.cell_id_rule_label,
    naming: config.naming,
    current_sign_standard: 'charge_positive_discharge_negative',
    expected_output_root: 'outputs/processed_dataset',
    expected_report: 'outputs/preprocessing_report.json',
    required_outputs: {
      time_series: '*_timeseries.csv',
      cycle_summary: '*_cycle_summary.csv',
      metadata: 'dataset_metadata.csv'
    },
    columns: {
      time_series: PP_TS_COLUMNS,
      cycle_summary: PP_CYCLE_COLUMNS,
      metadata: PP_METADATA_COLUMNS
    }
  };
  return JSON.stringify(context, null, 2) + '\n';
}

function ppSkillMd(config) {
  return [
    '---',
    'name: batterylake-preprocessing',
    'description: Use when converting raw battery cycling datasets in CSV, TXT, Excel, MAT, HDF5, or mixed formats into the fixed BatteryLake processed dataset schema for SOH/RUL benchmark training. The skill guides an AI agent to inspect source files, identify time, voltage, current, temperature, cycle, capacity, and cell fields, process each cell, validate outputs, and write preprocessing_report.json.',
    '---',
    '',
    '# BatteryLake Preprocessing',
    '',
    'Use this skill to turn raw battery cycling data into the fixed BatteryLake processed dataset format.',
    '',
    '## Required context',
    '',
    '- Read `references/dataset_context.json` first. It contains the dataset ref_name, source format hint, cell count, cell ID rule, chemistry, form factor, C-rates, and temperature.',
    '- Read `references/batterylake_schema.md` before writing code. The output schema is fixed.',
    '- Raw source files stay on the user machine. Do not assume they match any known public dataset until you inspect them.',
    '',
    '## Workflow',
    '',
    '1. Ask the user for the raw source folder path if it is not already provided.',
    '2. Inventory the source folder recursively. Record file extensions, folder structure, file sizes, sheet names, MAT/HDF5 keys, column headers, and a small row sample.',
    '3. Decide the cell boundary using `cell_count` and `cell_id_rule`: file name, folder name, source column, or manual list.',
    '4. Identify BatteryLake channels from evidence in the source files: time_s, voltage_V, current_A, temperature_C, cycle_id, capacity, charge/discharge state, and cell_id.',
    '5. If any mapping is ambiguous, stop and ask the user. Do not silently guess important labels.',
    '6. Write the smallest local converter needed for this dataset. Keep dataset-specific parsing in the working folder, not in this skill.',
    '7. Standardize current_A so charge is positive and discharge is negative.',
    '8. Export `outputs/processed_dataset/` with one `*_timeseries.csv` and one `*_cycle_summary.csv` per cell, plus one `dataset_metadata.csv`.',
    '9. Run `python scripts/validate_batterylake_outputs.py --data outputs/processed_dataset --context references/dataset_context.json --out outputs/preprocessing_report.json`.',
    '10. Show the user the report path, status, cell count, row counts, warnings, and whether `benchmark_ready` is true.',
    '',
    '## Hard rules',
    '',
    '- Never fabricate I / V / T / time / cycle mappings. Use source evidence.',
    '- Never upload raw source data to a remote service unless the user explicitly asks.',
    '- Preserve units in output column names: seconds, volts, amps, Celsius, amp-hours.',
    '- If the dataset is not an aging dataset, mark that clearly in warnings before it is used for SOH/RUL Benchmark.',
    '- The final output must pass the bundled validator.'
  ].join('\n') + '\n';
}

function ppSkillSchemaMd() {
  return [
    '# BatteryLake Processed Dataset Schema',
    '',
    'The AI agent must export the same three file types for every dataset.',
    '',
    '## Time-series files',
    '',
    'File pattern: `*_timeseries.csv`.',
    '',
    'Required columns:',
    PP_TS_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    'Rules:',
    '- `cell_id` must identify one physical cell.',
    '- `cycle_id` must be numeric or consistently sortable.',
    '- `time_s` is elapsed time in seconds within the cycle or record segment.',
    '- `voltage_V` is cell voltage in volts.',
    '- `current_A` uses charge > 0 and discharge < 0.',
    '- `temperature_C` is Celsius. Use empty values only when temperature is genuinely unavailable.',
    '- `step_type` should be charge, discharge, rest, or unknown.',
    '',
    '## Cycle-summary files',
    '',
    'File pattern: `*_cycle_summary.csv`.',
    '',
    'Required columns:',
    PP_CYCLE_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    'Rules:',
    '- `capacity_Ah` should be the main discharge capacity when available.',
    '- `SOH` is capacity normalized to a clear baseline when available.',
    '- `RUL` is remaining useful life in cycles when the task definition supports it.',
    '- If SOH/RUL cannot be scientifically defined from the source data, leave them empty and add a warning.',
    '',
    '## Metadata file',
    '',
    'File name: `dataset_metadata.csv`.',
    '',
    'Required columns:',
    PP_METADATA_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    '## Report',
    '',
    'The final report must be written to `outputs/preprocessing_report.json` and should include:',
    '- `dataset_id`',
    '- `status`: pass or fail',
    '- `benchmark_ready`: true or false',
    '- `counts` for time-series files, cycle-summary files, metadata rows, cells, and rows',
    '- `warnings` for assumptions, missing fields, non-aging data, or ambiguous mappings',
    '- `errors` for schema failures'
  ].join('\n') + '\n';
}

function ppSkillValidatorPy() {
  return String.raw`#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path

TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS, null, 2)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS, null, 2)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS, null, 2)}


def read_header(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        try:
            return next(csv.reader(handle))
        except StopIteration:
            return []


def count_rows(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def read_metadata_cells(path):
    if not path.exists():
        return set(), 0
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return {str(row.get("cell_id", "")).strip() for row in rows if row.get("cell_id")}, len(rows)


def missing_columns(path, required):
    header = read_header(path)
    return [col for col in required if col not in header]


def validate(data_root, context):
    data_root = Path(data_root)
    errors = []
    warnings = []
    ts_files = sorted(data_root.glob("*_timeseries.csv"))
    cs_files = sorted(data_root.glob("*_cycle_summary.csv"))
    metadata_path = data_root / "dataset_metadata.csv"

    if not data_root.exists():
        errors.append("processed dataset folder does not exist: %s" % data_root)
    if not ts_files:
        errors.append("no *_timeseries.csv files found")
    if not cs_files:
        errors.append("no *_cycle_summary.csv files found")
    if not metadata_path.exists():
        errors.append("dataset_metadata.csv is missing")

    for path in ts_files:
        missing = missing_columns(path, TS_COLUMNS)
        if missing:
            errors.append("%s missing columns: %s" % (path.name, ", ".join(missing)))
    for path in cs_files:
        missing = missing_columns(path, CYCLE_COLUMNS)
        if missing:
            errors.append("%s missing columns: %s" % (path.name, ", ".join(missing)))
    if metadata_path.exists():
        missing = missing_columns(metadata_path, METADATA_COLUMNS)
        if missing:
            errors.append("dataset_metadata.csv missing columns: %s" % ", ".join(missing))

    ts_cells = {path.name.replace("_timeseries.csv", "") for path in ts_files}
    cs_cells = {path.name.replace("_cycle_summary.csv", "") for path in cs_files}
    meta_cells, metadata_rows = read_metadata_cells(metadata_path)
    if ts_cells != cs_cells:
        errors.append("time-series cells and cycle-summary cells do not match")
    if meta_cells and ts_cells and not ts_cells.issubset(meta_cells):
        warnings.append("metadata does not list every exported cell")

    expected_cells = int(context.get("cell_count") or 0)
    if expected_cells and ts_cells and expected_cells != len(ts_cells):
        warnings.append("expected %d cells from page context, exported %d cells" % (expected_cells, len(ts_cells)))

    ts_rows = sum(count_rows(path) for path in ts_files)
    cs_rows = sum(count_rows(path) for path in cs_files)
    if ts_rows == 0:
        errors.append("time-series files contain 0 data rows")
    if cs_rows == 0:
        errors.append("cycle-summary files contain 0 data rows")

    status = "pass" if not errors else "fail"
    return {
        "dataset_id": context.get("dataset_id", data_root.name),
        "status": status,
        "benchmark_ready": status == "pass" and bool(ts_files) and bool(cs_files) and metadata_path.exists(),
        "counts": {
            "time_series_files": len(ts_files),
            "cycle_summary_files": len(cs_files),
            "metadata_rows": metadata_rows,
            "cells": len(ts_cells),
            "time_series_rows": ts_rows,
            "cycle_summary_rows": cs_rows
        },
        "warnings": warnings,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="outputs/processed_dataset")
    parser.add_argument("--context", default="references/dataset_context.json")
    parser.add_argument("--out", default="outputs/preprocessing_report.json")
    args = parser.parse_args()

    context_path = Path(args.context)
    context = json.loads(context_path.read_text(encoding="utf-8")) if context_path.exists() else {}
    report = validate(args.data, context)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
`;
}

function ppBuildSkillFiles(root, config) {
  return [
    { name: root + '/SKILL.md', data: ppSkillMd(config) },
    { name: root + '/references/batterylake_schema.md', data: ppSkillSchemaMd() },
    { name: root + '/references/dataset_context.json', data: ppDatasetContextJson(config) },
    { name: root + '/scripts/validate_batterylake_outputs.py', data: ppSkillValidatorPy() }
  ];
}

function ppCsvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function ppColumnMapCsv(config) {
  const mapping = (config && config.column_mapping) || {};
  const raw = key => ppCsvCell(mapping[key] || ('replace_with_' + key + '_label'));
  return [
    'canonical_column,source_column,unit,sign,required,meaning',
    'cell_id,' + raw('cell_id') + ',,keep,no,cell identifier; use constant cell_id from cell_ranges.csv if absent',
    'cycle_id,' + raw('cycle_id') + ',,keep,yes,cycle index in the raw file',
    'time_s,' + raw('time_s') + ',s,keep,yes,time channel',
    'voltage_V,' + raw('voltage_V') + ',V,keep,yes,V(t) voltage channel',
    'current_A,' + raw('current_A') + ',A,charge_positive_discharge_negative,yes,I(t) current channel; output standard is charge > 0 and discharge < 0',
    'temperature_C,' + raw('temperature_C') + ',C,keep,yes,T(t) temperature channel',
    'charge_capacity_Ah,replace_with_charge_capacity_label,Ah,keep,no,charge capacity if present',
    'discharge_capacity_Ah,replace_with_discharge_capacity_label,Ah,keep,no,discharge capacity if present',
    'step_type,replace_with_step_label,,keep,no,charge/discharge/rest label if present'
  ].join('\n') + '\n';
}

function ppCellRangesCsv(config) {
  const files = ((config && Array.isArray(config.source_files) && config.source_files.length) ? config.source_files : [(config && config.source_file) || 'replace_with_raw_file.csv']).filter(Boolean);
  const naming = (config && config.naming) || {};
  const chemistry = ppCsvCell(naming.chemistry || 'unknown');
  const formFactor = ppCsvCell(naming.form_factor || 'unknown');
  const temp = ppCsvCell(naming.temperature || '');
  const cRate = ppCsvCell([naming.charge_c_rate, naming.discharge_c_rate].filter(Boolean).join('/') || 'unknown');
  const used = new Set();
  const rows = files.map((file, index) => {
    let cellId = ppCellIdFromSourceFile(file, index);
    if (used.has(cellId)) cellId = cellId + '_' + String(index + 1).padStart(3, '0');
    used.add(cellId);
    return ppCsvCell(cellId) + ',' + ppCsvCell(file) + ',1,999,unassigned,' + chemistry + ',' + formFactor + ',,,' + temp + ',unknown,unknown,' + cRate + ',,';
  });
  return [
    'cell_id,source_file,start_cycle,end_cycle,split_tag,chemistry,form_factor,nominal_capacity_Ah,nominal_voltage_V,temperature_C,charge_protocol,discharge_protocol,C_rate,cutoff_voltage_upper,cutoff_voltage_lower'
  ].concat(rows).join('\n') + '\n';
}

function ppReadmeMd(config) {
  const root = ppPackageName(config.adapter, config.dataset_id);
  return `# BatteryLake preprocessing package

This package converts original battery cycling source data into the fixed BatteryLake processed-dataset format used by the Benchmark page.

If you select \`BatteryArchive processed CSV\`, the package only validates and repackages files that are already in BatteryLake-like schema. That adapter is a passthrough check, not a raw-source conversion.

This preprocessing package can process multiple cells in one run. Each selected source file is treated as exactly one cell, and the output cell_id is generated from that file name.

## Put data here

Copy the selected cell source files into:

\`\`\`
${root}/raw/
\`\`\`

Keep the same file names that were selected in the browser. Do not put multiple cells inside one source file.

## Run locally

\`\`\`bash
cd ${root}
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Step A: inspect original source labels first
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
open outputs/raw_columns.csv

# Step B: edit schema/column_map.csv
# Map source labels to:
#   voltage_V      = V(t)
#   current_A      = I(t)
#   temperature_C  = T(t)
#   time_s         = time
#   cycle_id       = cycle index

# Step C: convert and validate
bash run_preprocessing.sh
\`\`\`

## Output

The run writes:

\`\`\`
outputs/processed_dataset/
outputs/preprocessing_report.json
\`\`\`

Upload \`outputs/preprocessing_report.json\` back to the Preprocessing page. If the report says \`benchmark_ready: true\`, copy the whole \`outputs/processed_dataset/\` folder into the Benchmark training package under \`data/<dataset_name>/\`.
`;
}

function ppRequirementsTxt(config) {
  return ['numpy>=1.24', 'pandas>=2.0', 'scipy>=1.10', 'h5py>=3.8', 'openpyxl>=3.1'].join('\n') + '\n';
}

function ppRunPreprocessingSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

mkdir -p outputs
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
python scripts/convert.py --config config.json
python scripts/validate_outputs.py --config config.json --data outputs/processed_dataset --out outputs/preprocessing_report.json
python scripts/export_report.py --report outputs/preprocessing_report.json
`;
}

function ppInspectRawPy() {
  return `#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def delimited_header(path):
    sample = ""
    try:
        with Path(path).open("r", encoding="utf-8-sig", newline="") as f:
            sample = f.read(4096)
    except UnicodeDecodeError:
        with Path(path).open("r", encoding="latin-1", newline="") as f:
            sample = f.read(4096)
    if Path(path).suffix.lower() in (".txt", ".tsv", ".001"):
        dialect = csv.excel_tab
    else:
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\\t;|")
        except csv.Error:
            dialect = csv.excel
    lines = sample.splitlines()
    for line in lines[:80]:
        cells = [cell.strip() for cell in next(csv.reader([line], dialect), [])]
        if {"Rec", "Cycle", "Step"}.issubset(set(cells)) or {"Test Time", "Current", "Voltage"}.issubset(set(cells)):
            return cells
    return next(csv.reader(lines, dialect), [])


def xlsx_headers(path):
    try:
        import pandas as pd
        workbook = pd.ExcelFile(path)
        rows = []
        for sheet in workbook.sheet_names:
            frame = pd.read_excel(path, sheet_name=sheet, nrows=0)
            rows.append({"sheet": sheet, "columns": list(frame.columns)})
        return rows
    except Exception as exc:
        return [{"sheet": "", "columns": ["ERROR: " + str(exc)]}]


def unique_preserve(items, limit=400):
    seen = set()
    out = []
    for item in items:
        text = str(item)
        if text and text not in seen:
            seen.add(text)
            out.append(text)
        if len(out) >= limit:
            break
    return out


def mat_field_paths(obj, prefix="", depth=0):
    if depth > 6:
        return [prefix] if prefix else []
    if isinstance(obj, dict):
        paths = []
        for key, value in obj.items():
            key = str(key)
            if key.startswith("__"):
                continue
            child = prefix + "." + key if prefix else key
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths)
    if isinstance(obj, (list, tuple)):
        paths = []
        child = prefix + "[]" if prefix else "[]"
        for value in list(obj)[:3]:
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths) or ([child] if prefix else [])
    dtype = getattr(obj, "dtype", None)
    if dtype is not None and getattr(dtype, "names", None):
        paths = []
        for name in dtype.names:
            child = prefix + "." + str(name) if prefix else str(name)
            try:
                value = obj[name]
            except Exception:
                value = None
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths)
    if dtype is not None and str(dtype) == "object" and getattr(obj, "size", 0):
        paths = []
        for value in list(obj.flat)[:3]:
            paths.extend(mat_field_paths(value, prefix, depth + 1))
        return unique_preserve(paths) or ([prefix] if prefix else [])
    return [prefix] if prefix else []


def mat_keys(path):
    try:
        from scipy.io import loadmat
        mat = loadmat(path, simplify_cells=True)
        paths = []
        for key, value in mat.items():
            if not str(key).startswith("__"):
                paths.extend(mat_field_paths(value, str(key)))
        return unique_preserve(paths)
    except Exception as exc:
        return ["ERROR: " + str(exc)]


def inspect_columns(raw, files):
    rows = []
    for path in files:
        suffix = path.suffix.lower()
        rel = str(path.relative_to(raw))
        if suffix in (".csv", ".txt", ".tsv", ".001"):
            rows.append({"file": rel, "type": suffix.lstrip("."), "sheet": "", "columns": delimited_header(path)})
        elif suffix in (".xlsx", ".xls"):
            for sheet in xlsx_headers(path):
                rows.append({"file": rel, "type": suffix.lstrip("."), "sheet": sheet["sheet"], "columns": sheet["columns"]})
        elif suffix == ".mat":
            rows.append({"file": rel, "type": "mat", "sheet": "", "columns": mat_keys(path)})
    return rows


def source_entries(raw, rows):
    data_rows = [row for row in rows if row.get("type") in ("csv", "txt", "tsv", "001", "mat")]
    folders = {}
    for row in data_rows:
        parent = str(Path(row["file"]).parent)
        if parent in ("", "."):
            continue
        folders.setdefault(parent, []).append(row)
    grouped = []
    for folder, members in sorted(folders.items()):
        if len(members) < 2:
            continue
        cols = []
        for member in members:
            cols.extend(member.get("columns") or [])
        grouped.append({
            "path": folder,
            "type": "folder",
            "file_count": len(members),
            "columns": unique_preserve(cols)
        })
    if grouped:
        return grouped
    return [
        {
            "path": row["file"],
            "type": row["type"],
            "file_count": 1,
            "columns": row.get("columns") or []
        }
        for row in data_rows
    ]


def write_raw_columns(path, rows):
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["file", "type", "sheet", "columns"])
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "file": row["file"],
                "type": row["type"],
                "sheet": row["sheet"],
                "columns": " | ".join(map(str, row["columns"]))
            })


def write_raw_schema(path, raw, rows, files, ext, source_format):
    payload = {
        "schema_version": "raw-schema-v1",
        "raw_root": str(raw.resolve()),
        "source_format": source_format,
        "file_count": len(files),
        "extensions": dict(sorted(ext.items())),
        "source_entries": source_entries(raw, rows),
        "files": [
            {
                "path": row["file"],
                "type": row["type"],
                "sheet": row["sheet"],
                "columns": list(map(str, row["columns"]))
            }
            for row in rows
        ]
    }
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default=".")
    parser.add_argument("--format", default="auto", choices=["auto", "csv_folder", "excel_workbook", "matlab_mat", "processed_csv"])
    parser.add_argument("--out", default="outputs/raw_inventory.json")
    parser.add_argument("--columns-out", default="outputs/raw_columns.csv")
    parser.add_argument("--schema-out", default="outputs/raw_schema.json")
    args = parser.parse_args()
    raw = Path(args.raw).expanduser()
    if not raw.exists() or not raw.is_dir():
        parser.error("The selected folder does not exist: " + str(raw))
    all_files = [p for p in raw.rglob("*") if p.is_file() and not p.name.startswith(".") and "README" not in p.name.upper()]
    if not all_files:
        parser.error("No source files found in the selected folder: " + str(raw))
    allowed = {
        "csv_folder": {".csv", ".txt", ".tsv", ".001"},
        "processed_csv": {".csv", ".txt", ".tsv", ".001"},
        "excel_workbook": {".xlsx", ".xls"},
        "matlab_mat": {".mat"}
    }.get(args.format)
    files = all_files
    if allowed:
        files = [p for p in all_files if p.suffix.lower() in allowed]
        if not files:
            found = sorted(set(p.suffix.lower() or "<none>" for p in all_files))
            parser.error(
                "No files matching --format " + args.format
                + ". Expected extensions: " + ", ".join(sorted(allowed))
                + ". Found extensions: " + ", ".join(found)
            )
    ext = Counter(p.suffix.lower() or "<none>" for p in files)
    column_rows = inspect_columns(raw, files)
    report = {
        "raw_root": str(raw.resolve()),
        "file_count": len(files),
        "extensions": dict(sorted(ext.items())),
        "sample_files": [str(p.relative_to(raw)) for p in files[:30]],
        "column_preview_file": args.columns_out,
        "source_format": args.format
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_raw_columns(args.columns_out, column_rows)
    write_raw_schema(args.schema_out, raw, column_rows, files, ext, args.format)
    print("Raw inventory:", len(files), "files")
    print("Raw column preview:", args.columns_out)
    print("Raw schema:", args.schema_out)


if __name__ == "__main__":
    main()
`;
}

function ppConvertPy() {
  return `#!/usr/bin/env python3
import argparse
import importlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    args = parser.parse_args()
    config_path = Path(args.config)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    adapter = config["adapter"]
    module = importlib.import_module("adapters." + adapter)
    raw_root = ROOT / config.get("raw_root", "raw")
    schema_root = ROOT / config.get("schema_root", "schema")
    out_root = ROOT / config.get("output_root", "outputs/processed_dataset")
    out_root.mkdir(parents=True, exist_ok=True)
    manifest = module.convert(raw_root, schema_root, out_root, config)
    manifest_path = ROOT / "outputs" / "conversion_manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Converted dataset:", manifest.get("dataset_id"), "->", out_root)


if __name__ == "__main__":
    main()
`;
}

function ppValidateOutputsPy() {
  return `#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path


def read_header(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f), [])


def count_rows(path):
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        return max(0, sum(1 for _ in f) - 1)


def validate_group(files, required, label, errors):
    rows = 0
    for path in files:
        header = read_header(path)
        if header != required:
            missing = [c for c in required if c not in header]
            extra = [c for c in header if c not in required]
            errors.append({"file": str(path), "type": label, "missing": missing, "extra": extra})
        rows += count_rows(path)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--data", default="outputs/processed_dataset")
    parser.add_argument("--out", default="outputs/preprocessing_report.json")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    data = Path(args.data)
    ts_cols = config["time_series_columns"]
    cs_cols = config["cycle_summary_columns"]
    md_cols = config["metadata_columns"]
    ts_files = sorted(data.rglob("*_timeseries.csv"))
    cs_files = sorted(data.rglob("*_cycle_summary.csv"))
    md_files = sorted([p for p in data.rglob("*.csv") if "metadata" in p.name.lower()])
    errors = []
    if not ts_files:
        errors.append({"type": "time_series", "message": "No *_timeseries.csv files found."})
    if not cs_files:
        errors.append({"type": "cycle_summary", "message": "No *_cycle_summary.csv files found."})
    if not md_files:
        errors.append({"type": "metadata", "message": "No metadata CSV file found."})
    ts_rows = validate_group(ts_files, ts_cols, "time_series", errors)
    cs_rows = validate_group(cs_files, cs_cols, "cycle_summary", errors)
    md_rows = validate_group(md_files, md_cols, "metadata", errors)
    cells = set()
    for path in md_files:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.DictReader(f):
                    if row.get("cell_id"):
                        cells.add(row["cell_id"])
        except Exception:
            pass
    report = {
        "dataset_id": config["dataset_id"],
        "adapter": config["adapter"],
        "status": "pass" if not errors else "fail",
        "benchmark_ready": not errors,
        "data_root": str(data),
        "counts": {
            "time_series_files": len(ts_files),
            "cycle_summary_files": len(cs_files),
            "metadata_files": len(md_files),
            "time_series_rows": ts_rows,
            "cycle_summary_rows": cs_rows,
            "metadata_rows": md_rows,
            "cells": len(cells)
        },
        "errors": errors
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Validation status:", report["status"])
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
`;
}

function ppExportReportPy() {
  return `#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default="outputs/preprocessing_report.json")
    args = parser.parse_args()
    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    counts = report.get("counts", {})
    print("")
    print("BatteryLake preprocessing report")
    print("Dataset:", report.get("dataset_id"))
    print("Adapter:", report.get("adapter"))
    print("Status:", report.get("status"))
    print("Benchmark ready:", report.get("benchmark_ready"))
    print("Time-series files:", counts.get("time_series_files", 0))
    print("Cycle-summary files:", counts.get("cycle_summary_files", 0))
    print("Metadata rows:", counts.get("metadata_rows", 0))
    print("")
    print("Upload this file in the Preprocessing page:", args.report)


if __name__ == "__main__":
    main()
`;
}

function ppBatteryarchiveAdapterPy() {
  return `import csv
import json
import shutil
from pathlib import Path

import pandas as pd


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def read_header(path):
    with Path(path).open("r", encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f), [])


def unique_dest(out_root, source):
    name = source.name
    dest = out_root / name
    if not dest.exists():
        return dest
    stem = source.stem
    suffix = source.suffix
    parent = source.parent.name.replace(" ", "_")
    return out_root / ("%s__%s%s" % (parent, stem, suffix))


def copy_csv(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)


def write_metadata(source, out_root, config, used_name):
    df = pd.read_csv(source)
    for col in METADATA_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[METADATA_COLUMNS]
    df["dataset_id"] = config["dataset_id"]
    dest = out_root / ("dataset_metadata.csv" if not used_name else source.name)
    df.to_csv(dest, index=False)
    return dest


def convert(raw_root, schema_root, out_root, config):
    csv_files = sorted([p for p in Path(raw_root).rglob("*.csv") if not p.name.startswith(".")])
    copied = {"time_series": [], "cycle_summary": [], "metadata": []}
    metadata_written = False
    for path in csv_files:
        header = read_header(path)
        if header == TS_COLUMNS:
            dest = unique_dest(out_root, path)
            copy_csv(path, dest)
            copied["time_series"].append(str(dest.relative_to(out_root)))
        elif header == CYCLE_COLUMNS:
            dest = unique_dest(out_root, path)
            copy_csv(path, dest)
            copied["cycle_summary"].append(str(dest.relative_to(out_root)))
        elif header == METADATA_COLUMNS or "metadata" in path.name.lower():
            dest = write_metadata(path, out_root, config, metadata_written)
            metadata_written = True
            copied["metadata"].append(str(dest.relative_to(out_root)))
    if not metadata_written and copied["time_series"]:
        cells = []
        for rel in copied["time_series"]:
            cell = Path(rel).name.replace("_timeseries.csv", "")
            cells.append(cell)
        rows = []
        for cell in sorted(cells):
            rows.append({
                "dataset_id": config["dataset_id"], "cell_id": cell, "source_type": "local",
                "split_tag": "unassigned", "chemistry": "unknown", "cathode_material": "unknown",
                "anode_material": "unknown", "brand_or_manufacturer": "unknown",
                "model_or_size": "unknown", "form_factor": "unknown",
                "nominal_capacity_Ah": "", "nominal_voltage_V": "", "temperature_C": "",
                "charge_protocol": "unknown", "discharge_protocol": "unknown", "C_rate": "unknown",
                "cutoff_voltage_upper": "", "cutoff_voltage_lower": ""
            })
        pd.DataFrame(rows, columns=METADATA_COLUMNS).to_csv(out_root / "dataset_metadata.csv", index=False)
        copied["metadata"].append("dataset_metadata.csv")
    return {"dataset_id": config["dataset_id"], "adapter": "batteryarchive_csv", "copied": copied}
`;
}

function ppGenericCsvAdapterPy() {
  return `from pathlib import Path
import re

import numpy as np
import pandas as pd


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def find_source_path(raw_root, name):
    target = Path(name)
    if target.is_absolute() and target.exists():
        return target
    direct = Path(raw_root) / name
    if direct.exists():
        return direct
    matches = [p for p in Path(raw_root).rglob(target.name)]
    if not matches:
        raise FileNotFoundError("Cannot find source_file listed in cell_ranges.csv: %s" % name)
    return matches[0]


def supported_raw_file(path):
    return path.is_file() and (not path.name.startswith(".")) and path.suffix.lower() in (".csv", ".txt", ".tsv", ".001")


def source_files(source):
    source = Path(source)
    if source.is_dir():
        return sorted([p for p in source.rglob("*") if supported_raw_file(p) and "README" not in p.name.upper()])
    return [source]


def header_info(path):
    try:
        lines = Path(path).read_text(encoding="utf-8-sig", errors="replace").splitlines()
    except Exception:
        lines = Path(path).read_text(encoding="latin-1", errors="replace").splitlines()
    sep = "\\t" if Path(path).suffix.lower() in (".txt", ".tsv", ".001") else ","
    for idx, line in enumerate(lines[:120]):
        cells = [cell.strip() for cell in line.split(sep)]
        if {"Rec", "Cycle", "Step"}.issubset(set(cells)) or {"Test Time", "Current", "Voltage"}.issubset(set(cells)):
            return idx, sep, "\\n".join(lines[:idx])
    return 0, sep, "\\n".join(lines[:8])


def read_raw_table(path):
    skiprows, sep, _ = header_info(path)
    if sep == "\\t":
        lines = Path(path).read_text(encoding="latin-1", errors="replace").splitlines()
        header = [col.strip() for col in lines[skiprows].split("\\t")]
        width = len(header)
        rows = []
        for line in lines[skiprows + 1:]:
            parts = line.split("\\t")
            if len(parts) < width:
                parts = parts + [""] * (width - len(parts))
            elif len(parts) > width:
                parts = parts[:width]
            rows.append(parts)
        raw = pd.DataFrame(rows, columns=header)
    else:
        raw = pd.read_csv(path, sep=sep, skiprows=skiprows, encoding="latin-1", engine="python")
    raw = raw.loc[:, ~raw.columns.astype(str).str.match(r"^Unnamed")]
    raw.columns = [str(col).strip() for col in raw.columns]
    return raw


def infer_temperature(path, fallback=""):
    _, _, meta = header_info(path)
    text = meta + "\\n" + str(path)
    matches = re.findall(r"(-?\\d+(?:\\.\\d+)?)\\s*(?:deg|°C)", text, flags=re.I)
    if matches:
        try:
            return float(matches[-1])
        except Exception:
            pass
    fallback_text = str(fallback or "")
    token = re.search(r"(-?\\d+(?:\\.\\d+)?)\\s*T$", fallback_text, flags=re.I)
    if token:
        try:
            return float(token.group(1))
        except Exception:
            pass
    return np.nan


def time_to_seconds(values, unit=""):
    if pd.api.types.is_numeric_dtype(values):
        return pd.to_numeric(values, errors="coerce") * unit_factor(unit)
    text = values.astype(str).str.strip()
    parsed = text.str.extract(r"(?:(\\d+)\\s*d)?\\s*(\\d+):([0-5]?\\d):([0-9]+(?:\\.\\d+)?)")
    if parsed.notna().any(axis=None):
        days = pd.to_numeric(parsed[0], errors="coerce").fillna(0)
        hours = pd.to_numeric(parsed[1], errors="coerce").fillna(0)
        minutes = pd.to_numeric(parsed[2], errors="coerce").fillna(0)
        seconds = pd.to_numeric(parsed[3], errors="coerce").fillna(0)
        return days * 86400.0 + hours * 3600.0 + minutes * 60.0 + seconds
    return pd.to_numeric(values, errors="coerce") * unit_factor(unit)


def unit_factor(unit):
    unit = str(unit or "").strip().lower()
    return {
        "ms": 0.001, "millisecond": 0.001,
        "min": 60.0, "minute": 60.0,
        "h": 3600.0, "hr": 3600.0, "hour": 3600.0,
        "mv": 0.001,
        "ma": 0.001,
        "k": 1.0
    }.get(unit, 1.0)


def normalize_temperature(values, unit):
    unit = str(unit or "").strip().lower()
    if unit == "k":
        return values - 273.15
    return values


def load_column_map(schema_root):
    path = Path(schema_root) / "column_map.csv"
    df = pd.read_csv(path).fillna("")
    return {row["canonical_column"]: row for _, row in df.iterrows() if row.get("source_column")}


def is_placeholder(value):
    value = str(value or "").strip()
    return (not value) or value.startswith("replace_with_")


def require_source_mappings(raw, mapping, source):
    required = ["cycle_id", "time_s", "voltage_V", "current_A"]
    missing = []
    for canonical in required:
        row = mapping.get(canonical)
        source_column = str(row.get("source_column", "")).strip() if row is not None else ""
        if is_placeholder(source_column):
            missing.append("%s -> <not mapped>" % canonical)
        elif source_column not in raw.columns:
            missing.append("%s -> %s (not found)" % (canonical, source_column))
    if missing:
        raise ValueError(
            "column_map.csv must map raw labels to I/V/T and cycle fields before conversion. "
            "Run scripts/inspect_raw.py and use outputs/raw_columns.csv to fill mappings for %s. Missing: %s"
            % (source, "; ".join(missing))
        )


def build_timeseries(raw, mapping, cell_id, start_cycle, end_cycle, source_path="", file_index=0, cycle_offset=0, temperature_value=np.nan):
    out = pd.DataFrame()
    for canonical in TS_COLUMNS:
        row = mapping.get(canonical)
        if row is not None and row["source_column"] in raw.columns:
            series = raw[row["source_column"]]
            if canonical not in ("cell_id", "step_type"):
                if canonical == "time_s":
                    series = time_to_seconds(series, row.get("unit"))
                else:
                    series = pd.to_numeric(series, errors="coerce")
                    series = series * unit_factor(row.get("unit"))
                if canonical == "temperature_C":
                    series = normalize_temperature(series, row.get("unit"))
            out[canonical] = series
        else:
            out[canonical] = np.nan
    out["cell_id"] = cell_id
    if out["cycle_id"].isna().all():
        out["cycle_id"] = file_index + 1
    out["cycle_id"] = pd.to_numeric(out["cycle_id"], errors="coerce").fillna(1).astype(int)
    if out["cycle_id"].nunique(dropna=True) <= 1:
        out["cycle_id"] = file_index + 1
    else:
        out["cycle_id"] = out["cycle_id"] + cycle_offset
    if start_cycle:
        out = out[out["cycle_id"] >= int(start_cycle)]
    if end_cycle:
        out = out[out["cycle_id"] <= int(end_cycle)]
    if "MD" in raw.columns and out["step_type"].isna().all():
        mode = raw["MD"].astype(str).str.strip().str.upper()
        out["step_type"] = np.where(mode.eq("C"), "charge", np.where(mode.eq("D"), "discharge", np.where(mode.eq("R"), "rest", "unknown")))
        current = pd.to_numeric(out["current_A"], errors="coerce")
        out.loc[mode.eq("D"), "current_A"] = -current[mode.eq("D")].abs()
        out.loc[mode.eq("C"), "current_A"] = current[mode.eq("C")].abs()
        out.loc[mode.eq("R"), "current_A"] = 0.0
    else:
        out["step_type"] = out["step_type"].fillna("unknown").astype(str)
        current = pd.to_numeric(out["current_A"], errors="coerce")
        out.loc[current > 0, "step_type"] = out.loc[current > 0, "step_type"].replace("unknown", "charge")
        out.loc[current < 0, "step_type"] = out.loc[current < 0, "step_type"].replace("unknown", "discharge")
    if out["temperature_C"].isna().all() and temperature_value == temperature_value:
        out["temperature_C"] = float(temperature_value)
    if "Capacity" in raw.columns:
        cap = pd.to_numeric(raw["Capacity"], errors="coerce")
        out.loc[out["step_type"].eq("charge"), "charge_capacity_Ah"] = cap[out["step_type"].eq("charge")]
        out.loc[out["step_type"].eq("discharge"), "discharge_capacity_Ah"] = cap[out["step_type"].eq("discharge")]
    for col in ["charge_capacity_Ah", "discharge_capacity_Ah"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out[TS_COLUMNS]


def cycle_summary(ts):
    rows = []
    for cycle_id, g in ts.groupby("cycle_id", sort=True):
        g = g.sort_values("time_s")
        t = pd.to_numeric(g["time_s"], errors="coerce").to_numpy(float)
        i = pd.to_numeric(g["current_A"], errors="coerce").to_numpy(float)
        if len(t) > 1:
            dt = np.diff(t)
            cur = 0.5 * (i[:-1] + i[1:])
            discharge = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
            charge = float(np.nansum(np.maximum(cur, 0) * dt) / 3600.0)
        else:
            discharge = np.nan
            charge = np.nan
        capacity = float(np.nanmax(g["discharge_capacity_Ah"])) if g["discharge_capacity_Ah"].notna().any() else discharge
        rows.append({
            "cell_id": g["cell_id"].iloc[0], "cycle_id": int(cycle_id), "step_type": "cycle",
            "capacity_Ah": capacity, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": charge, "discharge_capacity_Ah": discharge,
            "temperature_max_C": float(pd.to_numeric(g["temperature_C"], errors="coerce").max()),
            "temperature_avg_C": float(pd.to_numeric(g["temperature_C"], errors="coerce").mean()),
            "charge_duration_s": np.nan, "discharge_duration_s": np.nan,
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    out = pd.DataFrame(rows, columns=CYCLE_COLUMNS)
    if len(out):
        first = out["capacity_Ah"].replace(0, np.nan).dropna()
        ref = float(first.iloc[0]) if len(first) else np.nan
        out["SOH"] = out["capacity_Ah"] / ref if ref == ref else np.nan
        out["RUL"] = len(out) - out["cycle_id"].rank(method="dense").astype(int)
    return out


def metadata_row(config, range_row):
    row = {col: "" for col in METADATA_COLUMNS}
    row.update({
        "dataset_id": config["dataset_id"],
        "cell_id": range_row["cell_id"],
        "source_type": "local",
        "split_tag": range_row.get("split_tag", "unassigned"),
        "chemistry": range_row.get("chemistry", "unknown"),
        "form_factor": range_row.get("form_factor", "unknown"),
        "nominal_capacity_Ah": range_row.get("nominal_capacity_Ah", ""),
        "nominal_voltage_V": range_row.get("nominal_voltage_V", ""),
        "temperature_C": range_row.get("temperature_C", ""),
        "charge_protocol": range_row.get("charge_protocol", "unknown"),
        "discharge_protocol": range_row.get("discharge_protocol", "unknown"),
        "C_rate": range_row.get("C_rate", "unknown"),
        "cutoff_voltage_upper": range_row.get("cutoff_voltage_upper", ""),
        "cutoff_voltage_lower": range_row.get("cutoff_voltage_lower", "")
    })
    return row


def convert(raw_root, schema_root, out_root, config):
    mapping = load_column_map(schema_root)
    ranges = pd.read_csv(Path(schema_root) / "cell_ranges.csv").fillna("")
    metadata = []
    created = []
    for _, row in ranges.iterrows():
        source = find_source_path(raw_root, row["source_file"])
        frames = []
        cycle_offset = 0
        for file_index, source_file in enumerate(source_files(source)):
            raw = read_raw_table(source_file)
            require_source_mappings(raw, mapping, source_file)
            temp = infer_temperature(source_file, row.get("temperature_C", ""))
            ts_part = build_timeseries(
                raw, mapping, row["cell_id"], row.get("start_cycle"), row.get("end_cycle"),
                source_path=source_file, file_index=file_index, cycle_offset=cycle_offset, temperature_value=temp
            )
            if len(ts_part):
                cycle_offset = int(pd.to_numeric(ts_part["cycle_id"], errors="coerce").max())
                frames.append(ts_part)
        if not frames:
            raise ValueError("No supported raw files found under source_file: %s" % source)
        ts = pd.concat(frames, ignore_index=True)
        ts_name = "%s_timeseries.csv" % row["cell_id"]
        cs_name = "%s_cycle_summary.csv" % row["cell_id"]
        ts.to_csv(Path(out_root) / ts_name, index=False)
        cycle_summary(ts).to_csv(Path(out_root) / cs_name, index=False)
        metadata.append(metadata_row(config, row))
        created.extend([ts_name, cs_name])
    pd.DataFrame(metadata, columns=METADATA_COLUMNS).to_csv(Path(out_root) / "dataset_metadata.csv", index=False)
    return {"dataset_id": config["dataset_id"], "adapter": "generic_csv_ranges", "created": created}
`;
}

function ppMatlabAdapterPy() {
  return `from pathlib import Path
import re

import numpy as np
import pandas as pd
from scipy.io import loadmat


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, np.ndarray):
        return list(value.ravel())
    return [value]


def arr(data, *names):
    for name in names:
        if isinstance(data, dict) and name in data:
            value = data[name]
            return np.asarray(value).ravel()
    return np.array([])


def scalar(data, *names):
    values = arr(data, *names)
    if len(values):
        try:
            return float(values[0])
        except Exception:
            return np.nan
    return np.nan


def find_file(raw_root, name):
    target = Path(str(name or ""))
    if target.is_absolute() and target.exists():
        return target
    direct = Path(raw_root) / target
    if direct.exists():
        return direct
    matches = [p for p in Path(raw_root).rglob(target.name) if p.is_file()]
    if not matches:
        raise FileNotFoundError("Cannot find selected source_file: %s" % name)
    return matches[0]


def find_cycle_container(mat):
    for value in mat.values():
        if isinstance(value, dict) and "cycle" in value:
            return value
    return None


def numeric_arr(data, *names):
    values = arr(data, *names)
    if not len(values):
        return np.array([])
    return pd.to_numeric(pd.Series(values), errors="coerce").to_numpy(float)


def monotonic_seconds_from_minutes(values):
    raw = np.asarray(values, dtype=float).ravel()
    if not len(raw):
        return np.array([])
    out = np.zeros(len(raw), dtype=float)
    offset = 0.0
    prev = raw[0]
    out[0] = raw[0]
    for idx in range(1, len(raw)):
        value = raw[idx]
        if value + 1e-9 < prev:
            offset += prev
        out[idx] = value + offset
        prev = value
    return out * 60.0


def summary_value(summary, key, index):
    if not isinstance(summary, dict) or key not in summary:
        return np.nan
    values = np.asarray(summary.get(key)).ravel()
    if index >= len(values):
        return np.nan
    try:
        return float(values[index])
    except Exception:
        return np.nan


def safe_nan_stat(values, fn):
    arr_values = np.asarray(values, dtype=float)
    if not len(arr_values) or np.isnan(arr_values).all():
        return np.nan
    return float(fn(arr_values))


def duration_by_sign(time_s, current, sign):
    if len(time_s) < 2:
        return np.nan
    if sign == "charge":
        mask = current[:-1] > 0.01
    else:
        mask = current[:-1] < -0.01
    dt = np.diff(time_s)
    return float(np.nansum(dt[mask])) if len(dt) else np.nan


def convert_data_list_cell(path, out_root, config, cell_id, mat):
    data_items = [item for item in as_list(mat.get("data")) if isinstance(item, dict)]
    if not data_items:
        raise ValueError("No Batch-style data[] cycles found in %s" % path.name)
    summary = mat.get("summary", {})
    ts_path = Path(out_root) / ("%s_timeseries.csv" % cell_id)
    cs_path = Path(out_root) / ("%s_cycle_summary.csv" % cell_id)
    if ts_path.exists():
        ts_path.unlink()
    cs_rows = []
    wrote_header = False
    for index, item in enumerate(data_items):
        cycle_id = index + 1
        time_min = numeric_arr(item, "relative_time_min", "time_min", "Time", "time")
        voltage = numeric_arr(item, "voltage_V", "Voltage_measured", "Voltage")
        current = numeric_arr(item, "current_A", "Current_measured", "Current")
        temp = numeric_arr(item, "temperature_C", "Temperature_measured", "Temperature")
        capacity = numeric_arr(item, "capacity_Ah", "Capacity")
        if not len(time_min) or not len(voltage) or not len(current):
            continue
        n = min(len(time_min), len(voltage), len(current), len(temp) if len(temp) else len(time_min), len(capacity) if len(capacity) else len(time_min))
        time_s = monotonic_seconds_from_minutes(time_min[:n])
        voltage = voltage[:n]
        current = current[:n]
        temp = temp[:n] if len(temp) else np.full(n, np.nan)
        capacity = capacity[:n] if len(capacity) else np.full(n, np.nan)
        step_type = np.where(current > 0.01, "charge", np.where(current < -0.01, "discharge", "rest"))
        charge_capacity = np.where(current > 0.01, capacity, np.nan)
        discharge_capacity = np.where(current < -0.01, capacity, np.nan)
        ts = pd.DataFrame({
            "cell_id": cell_id,
            "cycle_id": cycle_id,
            "time_s": time_s,
            "voltage_V": voltage,
            "current_A": current,
            "temperature_C": temp,
            "charge_capacity_Ah": charge_capacity,
            "discharge_capacity_Ah": discharge_capacity,
            "step_type": step_type
        }, columns=TS_COLUMNS)
        ts.to_csv(ts_path, mode="a", header=not wrote_header, index=False)
        wrote_header = True
        charge_cap = summary_value(summary, "charge_capacity_Ah", index)
        discharge_cap = summary_value(summary, "discharge_capacity_Ah", index)
        if discharge_cap != discharge_cap and len(time_s) > 1:
            dt = np.diff(time_s)
            cur = 0.5 * (current[:-1] + current[1:])
            discharge_cap = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
        if charge_cap != charge_cap and len(time_s) > 1:
            dt = np.diff(time_s)
            cur = 0.5 * (current[:-1] + current[1:])
            charge_cap = float(np.nansum(np.maximum(cur, 0) * dt) / 3600.0)
        cs_rows.append({
            "cell_id": cell_id, "cycle_id": cycle_id, "step_type": "cycle",
            "capacity_Ah": discharge_cap, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": charge_cap, "discharge_capacity_Ah": discharge_cap,
            "temperature_max_C": safe_nan_stat(temp, np.nanmax),
            "temperature_avg_C": safe_nan_stat(temp, np.nanmean),
            "charge_duration_s": duration_by_sign(time_s, current, "charge"),
            "discharge_duration_s": duration_by_sign(time_s, current, "discharge"),
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    if not wrote_header:
        raise ValueError("No usable Batch-style voltage/current/time arrays found in %s" % path.name)
    cs = pd.DataFrame(cs_rows, columns=CYCLE_COLUMNS)
    ref = cs["capacity_Ah"].replace(0, np.nan).dropna()
    if len(ref):
        cs["SOH"] = cs["capacity_Ah"] / float(ref.iloc[0])
    cs["RUL"] = len(cs) - cs["cycle_id"].rank(method="dense").astype(int)
    cs.to_csv(cs_path, index=False)
    return cell_id


def cell_id_from_path(path, index):
    stem = Path(path).stem
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", stem).strip("_")
    return clean or ("cell_%03d" % (index + 1))


def convert_one(path, out_root, config, cell_id):
    mat = loadmat(path, simplify_cells=True)
    root = find_cycle_container(mat)
    if not root:
        if mat.get("data") is not None:
            return convert_data_list_cell(path, out_root, config, cell_id, mat)
        raise ValueError("No NASA-like cycle structure found in %s" % path.name)
    ts_rows = []
    cs_rows = []
    discharge_caps = []
    cycle_number = 0
    for cycle in as_list(root.get("cycle")):
        if not isinstance(cycle, dict):
            continue
        cycle_number += 1
        step_type = str(cycle.get("type", "unknown"))
        data = cycle.get("data", {})
        time_s = arr(data, "Time", "time")
        voltage = arr(data, "Voltage_measured", "voltage_V", "Voltage")
        current = arr(data, "Current_measured", "current_A", "Current")
        temp = arr(data, "Temperature_measured", "temperature_C", "Temperature")
        if not len(time_s) or not len(voltage) or not len(current):
            continue
        n = min(len(time_s), len(voltage), len(current), len(temp) if len(temp) else len(time_s))
        if not len(temp):
            temp = np.full(n, np.nan)
        for idx in range(n):
            ts_rows.append({
                "cell_id": cell_id, "cycle_id": cycle_number, "time_s": float(time_s[idx]),
                "voltage_V": float(voltage[idx]), "current_A": float(current[idx]),
                "temperature_C": float(temp[idx]), "charge_capacity_Ah": np.nan,
                "discharge_capacity_Ah": np.nan, "step_type": step_type
            })
        cap = scalar(data, "Capacity", "capacity_Ah")
        if cap != cap and n > 1:
            dt = np.diff(time_s[:n])
            cur = 0.5 * (current[:n-1] + current[1:n])
            cap = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
        if step_type.lower() == "discharge" and cap == cap:
            discharge_caps.append(cap)
        cs_rows.append({
            "cell_id": cell_id, "cycle_id": cycle_number, "step_type": step_type,
            "capacity_Ah": cap, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": np.nan, "discharge_capacity_Ah": cap,
            "temperature_max_C": float(np.nanmax(temp[:n])) if n else np.nan,
            "temperature_avg_C": float(np.nanmean(temp[:n])) if n else np.nan,
            "charge_duration_s": np.nan, "discharge_duration_s": float(time_s[n-1] - time_s[0]) if n > 1 else np.nan,
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    if not ts_rows:
        raise ValueError("No usable voltage/current/time arrays found in %s" % path.name)
    ts = pd.DataFrame(ts_rows, columns=TS_COLUMNS)
    cs = pd.DataFrame(cs_rows, columns=CYCLE_COLUMNS)
    ref = discharge_caps[0] if discharge_caps else np.nan
    if ref == ref and ref != 0:
        cs["SOH"] = cs["capacity_Ah"] / ref
    cs["RUL"] = len(cs) - cs["cycle_id"].rank(method="dense").astype(int)
    ts.to_csv(Path(out_root) / ("%s_timeseries.csv" % cell_id), index=False)
    cs.to_csv(Path(out_root) / ("%s_cycle_summary.csv" % cell_id), index=False)
    return cell_id


def convert(raw_root, schema_root, out_root, config):
    selected = config.get("source_files") or []
    if not selected and config.get("source_file"):
        selected = [config.get("source_file")]
    if selected:
        mat_files = [find_file(raw_root, name) for name in selected]
    else:
        mat_files = sorted([p for p in Path(raw_root).rglob("*.mat") if p.is_file()])
    if not mat_files:
        raise FileNotFoundError("No .mat files found under raw/.")
    cells = []
    used = set()
    for index, path in enumerate(mat_files):
        cell_id = cell_id_from_path(path, index)
        if cell_id in used:
            cell_id = "%s_%03d" % (cell_id, index + 1)
        used.add(cell_id)
        cells.append(convert_one(path, out_root, config, cell_id))
    rows = []
    naming = config.get("naming", {})
    for cell_id in cells:
        rows.append({
            "dataset_id": config["dataset_id"], "cell_id": cell_id, "source_type": "local",
            "split_tag": "unassigned", "chemistry": naming.get("chemistry", "unknown"), "cathode_material": "unknown",
            "anode_material": "unknown", "brand_or_manufacturer": "unknown", "model_or_size": "unknown",
            "form_factor": naming.get("form_factor", "unknown"), "nominal_capacity_Ah": "", "nominal_voltage_V": "",
            "temperature_C": naming.get("temperature", ""), "charge_protocol": "unknown", "discharge_protocol": "unknown",
            "C_rate": (str(naming.get("charge_c_rate", "")) + "/" + str(naming.get("discharge_c_rate", ""))).strip("/"), "cutoff_voltage_upper": "", "cutoff_voltage_lower": ""
        })
    pd.DataFrame(rows, columns=METADATA_COLUMNS).to_csv(Path(out_root) / "dataset_metadata.csv", index=False)
    return {"dataset_id": config["dataset_id"], "adapter": "matlab_mat", "cells": cells}
`;
}

function ppInspectReadmeMd(config) {
  const root = ppInspectPackageName(config.source_format, config.dataset_id);
  return `# BatteryLake raw title inspector

This package only reads source file titles, CSV/Excel headers, and MATLAB keys.
It does not convert, clean, train, or upload raw data.

## Put data here

\`\`\`
${root}/raw/<original_dataset_folder>/
\`\`\`

## Run

\`\`\`bash
cd ${root}
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash run_inspect.sh
\`\`\`

## Upload back to the web page

\`\`\`
outputs/raw_schema.json
\`\`\`

The web page uses this small JSON file to build the I/V/T mapping dropdowns.
`;
}

function ppRunInspectSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

mkdir -p outputs
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
`;
}

function ppBuildInspectPackageFiles(root, config) {
  return [
    { name: root + '/README.md', data: ppInspectReadmeMd(config) },
    { name: root + '/config.json', data: JSON.stringify(config, null, 2) + '\n' },
    { name: root + '/requirements.txt', data: ppRequirementsTxt(config) },
    { name: root + '/run_inspect.sh', data: ppRunInspectSh() },
    { name: root + '/raw/', data: '' },
    { name: root + '/outputs/', data: '' },
    { name: root + '/scripts/inspect_raw.py', data: ppInspectRawPy() }
  ];
}

function ppDownloadInspectPackage() {
  const config = ppCurrentConfig();
  const blob = new Blob([ppInspectRawPy()], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inspect_batterylake_titles.py';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Inspect script downloaded: ' + a.download, 'success');
}

function ppPopulateSourceFileSelect() {
  const select = document.getElementById('pp-source-file-select');
  if (!select) return;
  const files = ppRawFileNames();
  select.innerHTML = files.length
    ? files.map(file => `<option value="${esc(file)}" selected>${esc(file)}</option>`).join('')
    : '<option value="">Upload raw_schema first</option>';
  ppUpdatePackagePreview();
}

function ppRenderRawSchema(schema) {
  const files = ppRawSchemaFiles();
  const columns = ppSchemaColumns();
  const summary = document.getElementById('pp-raw-schema-summary');
  if (summary) {
    if (!files.length) {
      summary.textContent = [
        'No source files detected in raw_schema.json.',
        'Check that Terminal is opened in the original dataset folder.',
        'Check that --format matches the file type: csv_folder, excel_workbook, or matlab_mat.'
      ].join('\n');
    } else {
      summary.textContent = [
        'files: ' + files.length,
        'variables: ' + columns.length,
        'first_file: ' + (ppFirstRawFile() || '-'),
        'selected_files: ' + ppSelectedSourceFiles().length,
        'sample_variables: ' + columns.slice(0, 12).join(', ')
      ].join('\n');
    }
  }
  const sourceFile = document.getElementById('pp2-source-file-preview');
  if (sourceFile) sourceFile.value = ppSelectedSourceFilesLabel(ppSelectedSourceFiles());
}

function ppPopulateMappingSelectors() {
  const cols = ppSchemaColumns();
  ppSetSelectOptions(document.getElementById('pp-map-time'), cols, ppGuessColumn(cols, ['times', 'testtime', 'time', 'timestamp', 'seconds']));
  ppSetSelectOptions(document.getElementById('pp-map-voltage'), cols, ppGuessColumn(cols, ['voltagev', 'voltagemeasured', 'voltage', 'volt', 'v']));
  ppSetSelectOptions(document.getElementById('pp-map-current'), cols, ppGuessColumn(cols, ['currenta', 'currentmeasured', 'current', 'curr', 'i']));
  ppSetSelectOptions(document.getElementById('pp-map-temperature'), cols, ppGuessColumn(cols, ['temperaturec', 'temperaturemeasured', 'temperature', 'temp', 't']));
  ppSetSelectOptions(document.getElementById('pp-map-cycle'), cols, ppGuessColumn(cols, ['cycleindex', 'cycleid', 'cycle']));
  ppSetSelectOptions(document.getElementById('pp-map-cell'), cols, ppGuessColumn(cols, ['cellid', 'barcode', 'cell']));
  ppPopulateSourceFileSelect();
  ppUpdatePackagePreview();
}

async function ppHandleRawSchemaUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const schema = JSON.parse(await file.text());
    PP.rawSchema = schema;
    ppPopulateMappingSelectors();
    ppRenderRawSchema(schema);
    ppUpdatePackagePreview();
    if (!ppRawSchemaFiles().length) {
      showToast('raw_schema.json has 0 files. Re-run inspect inside the dataset folder with the correct --format.', 'error');
    } else {
      showToast('Raw schema loaded. Choose I/V/T mappings next.', 'success');
    }
  } catch (err) {
    showToast('Cannot read this raw_schema.json.', 'error');
  }
}

function ppBuildPackageFiles(root, config) {
  const manifest = Object.assign({
    raw_root: 'raw',
    schema_root: 'schema',
    output_root: 'outputs/processed_dataset',
    time_series_columns: PP_TS_COLUMNS,
    cycle_summary_columns: PP_CYCLE_COLUMNS,
    metadata_columns: PP_METADATA_COLUMNS
  }, config || ppCurrentConfig());
  return [
    { name: root + '/README.md', data: ppReadmeMd(manifest) },
    { name: root + '/config.json', data: JSON.stringify(manifest, null, 2) + '\n' },
    { name: root + '/requirements.txt', data: ppRequirementsTxt(manifest) },
    { name: root + '/run_preprocessing.sh', data: ppRunPreprocessingSh() },
    { name: root + '/raw/', data: '' },
    { name: root + '/outputs/', data: '' },
    { name: root + '/schema/batterylake_schema.json', data: ppSchemaJson(manifest) },
    { name: root + '/schema/column_map.csv', data: ppColumnMapCsv(manifest) },
    { name: root + '/schema/cell_ranges.csv', data: ppCellRangesCsv(manifest) },
    { name: root + '/scripts/inspect_raw.py', data: ppInspectRawPy() },
    { name: root + '/scripts/convert.py', data: ppConvertPy() },
    { name: root + '/scripts/validate_outputs.py', data: ppValidateOutputsPy() },
    { name: root + '/scripts/export_report.py', data: ppExportReportPy() },
    { name: root + '/adapters/__init__.py', data: '' },
    { name: root + '/adapters/batteryarchive_csv.py', data: ppBatteryarchiveAdapterPy() },
    { name: root + '/adapters/generic_csv_ranges.py', data: ppGenericCsvAdapterPy() },
    { name: root + '/adapters/matlab_mat.py', data: ppMatlabAdapterPy() }
  ];
}

function ppDownloadPackage() {
  const config = ppCurrentConfig();
  if (!config.dataset_id || config.dataset_id === 'YYYY_SOURCE_CHEMISTRY_FORMFACTOR_CHRGC_DCHRG_TEMPT') {
    showToast('Fill the dataset naming fields before downloading the skill.', 'error');
    return;
  }
  if (!config.cell_count || config.cell_count < 1) {
    showToast('Cell count must be at least 1.', 'error');
    return;
  }
  const root = ppSkillRootName();
  const packageName = ppSkillPackageName(config.dataset_id);
  const blob = bwZipBlob(ppBuildSkillFiles(root, config));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packageName + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
    window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'preprocessing_skill' });
  }
  showToast('BatteryLake skill generated: ' + a.download, 'success');
}

function ppRenderReport(report) {
  const gate = document.getElementById('pp-report-gate');
  const ready = document.getElementById('pp-report-ready');
  const status = document.getElementById('pp-report-status');
  const summary = document.getElementById('pp-report-summary');
  const counts = report && report.counts ? report.counts : {};
  if (gate) gate.value = report.status || 'unknown';
  if (ready) ready.value = report.benchmark_ready ? 'Yes' : 'No';
  if (status) status.textContent = report.status || 'loaded';
  if (summary) {
    summary.textContent = [
      'dataset_id: ' + (report.dataset_id || '-'),
      'adapter: ' + (report.adapter || '-'),
      'status: ' + (report.status || '-'),
      'benchmark_ready: ' + String(!!report.benchmark_ready),
      'time_series_files: ' + (counts.time_series_files || 0),
      'cycle_summary_files: ' + (counts.cycle_summary_files || 0),
      'metadata_rows: ' + (counts.metadata_rows || 0),
      'errors: ' + ((report.errors || []).length)
    ].join('\n');
  }
  const summary2 = document.getElementById('pp2-report-summary');
  if (summary2) {
    summary2.textContent = [
      'dataset_id: ' + (report.dataset_id || '-'),
      'adapter: ' + (report.adapter || '-'),
      'status: ' + (report.status || '-'),
      'benchmark_ready: ' + String(!!report.benchmark_ready),
      'time_series_files: ' + (counts.time_series_files || 0),
      'cycle_summary_files: ' + (counts.cycle_summary_files || 0),
      'metadata_rows: ' + (counts.metadata_rows || 0),
      'errors: ' + ((report.errors || []).length)
    ].join('\n');
  }
  const verifyStatus = document.getElementById('pp2-verify-status');
  const verifyReady = document.getElementById('pp2-verify-ready');
  const verifySummary = document.getElementById('pp2-verification-summary');
  if (verifyStatus) verifyStatus.value = report.status || 'unknown';
  if (verifyReady) verifyReady.value = report.benchmark_ready ? 'Yes' : 'No';
  if (verifySummary) {
    verifySummary.textContent = [
      'dataset_id: ' + (report.dataset_id || '-'),
      'status: ' + (report.status || '-'),
      'benchmark_ready: ' + String(!!report.benchmark_ready),
      'cells: ' + (counts.cells || 0),
      'time_series_files: ' + (counts.time_series_files || 0),
      'cycle_summary_files: ' + (counts.cycle_summary_files || 0),
      'metadata_rows: ' + (counts.metadata_rows || 0),
      'warnings: ' + ((report.warnings || []).length),
      'errors: ' + ((report.errors || []).length)
    ].join('\n');
  }
}

async function ppHandleReportUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const report = JSON.parse(await file.text());
    PP.report = report;
    ppRenderReport(report);
    const panel = document.querySelector('#page-preprocessing [data-pp-panel="4"]');
    const uploadCheck = panel && panel.querySelector('.pp-check');
    if (uploadCheck && !uploadCheck.classList.contains('done')) ppToggleCheck(uploadCheck);
    showToast('Preprocessing report loaded.', report.benchmark_ready ? 'success' : 'info');
  } catch (err) {
    showToast('Cannot read this report JSON.', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   INIT — render built-in data immediately
   ══════════════════════════════════════════════════════════════ */
(async function init() {
  // Render fallback immediately so page isn't blank
  initTopbarControls();
  refreshAll();
  ppRender();
  if (typeof resetPrepSummary === 'function') resetPrepSummary();
  if (typeof renderAIFieldTable === 'function') renderAIFieldTable();
  const statusEl = document.getElementById('sync-status');
  if (statusEl) {
    statusEl.innerHTML = '<span class="sync-dot fallback"></span> Built-in · ' + getCatalogDatasets().length + ' datasets';
  }
  applyInitialPageFromHash();
})();

/* ══════════════════════════════════════════════════════════════
   BENCHMARK WORKSPACE — lightweight interactions
   ══════════════════════════════════════════════════════════════ */
function bwSingle(el, groupSel, cls) {
  document.querySelectorAll(groupSel).forEach(x => x.classList.remove(cls));
  el.classList.add(cls);
}
function bwTask(el, name) {
  bwSingle(el, '.bw-seg-btn', 'active');
  const s = document.getElementById('bw-sum-task'); if (s) s.textContent = name;
  bwUpdatePackagePreview();
}
function bwPickSplit(el, name) {
  document.querySelectorAll('.bw-split-card').forEach(c => {
    c.classList.remove('selected');
    const chk = c.querySelector('.bw-split-check'); if (chk) chk.remove();
  });
  el.classList.add('selected');
  const chk = document.createElement('span');
  chk.className = 'bw-split-check';
  chk.innerHTML = '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  el.appendChild(chk);
  BW.splitMode = (name === 'Random') ? 'random' : 'manual';
  const ctrl = document.getElementById('bw-random-ctrl');
  if (ctrl) ctrl.style.display = BW.splitMode === 'random' ? 'flex' : 'none';
  const s = document.getElementById('bw-sum-split'); if (s) s.textContent = name;
  const q = document.getElementById('bw-quick-split'); if (q) q.textContent = name + ' split';
  if (BW.splitMode === 'random') bwShuffleSplit();   // each click of Random re-draws
}
function bwRatioInput() {
  const g = id => { const e = document.getElementById(id); const v = e ? parseFloat(e.value) : 0; return isNaN(v) ? 0 : Math.max(0, v); };
  BW.ratio = { train: g('bw-ratio-train'), val: g('bw-ratio-val'), test: g('bw-ratio-test') };
}
function bwShuffleSplit() {
  const pool = [].concat(BW.split.train, BW.split.val, BW.split.test); // active (non-excluded) cells
  const total = pool.length;
  if (!total) { bwRenderSplit(); return; }
  for (let i = total - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  let rt = Math.max(0, +BW.ratio.train || 0), rv = Math.max(0, +BW.ratio.val || 0), rs = Math.max(0, +BW.ratio.test || 0);
  let sum = rt + rv + rs; if (sum <= 0) { rt = 60; rv = 20; rs = 20; sum = 100; }
  const nTrain = Math.round(total * rt / sum);
  const nVal = Math.round(total * rv / sum);
  const byNum = (a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
  BW.split.train = pool.slice(0, nTrain).sort(byNum);
  BW.split.val = pool.slice(nTrain, nTrain + nVal).sort(byNum);
  BW.split.test = pool.slice(nTrain + nVal).sort(byNum);
  bwRenderSplit();
}
function bwPickModel(el, name) {
  bwSingle(el, '.bw-model-card', 'selected');
  const s = document.getElementById('bw-sum-model'); if (s) s.textContent = name;
}
function bwToggleFeat(el) {
  if (el.classList.contains('bw-feat-add')) {
    bwMockAddSignal();
    return;
  }
  el.classList.toggle('selected');
  bwUpdateFeatureSummary();
}
function bwUpdateFeatureSummary() {
  const sel = document.querySelectorAll('#bw-feats .bw-feat.selected');
  const rawN = sel.length;
  const formulaN = parseInt((document.getElementById('bw-formula-count') || {}).textContent, 10) || 0;
  const label = rawN + ' raw signal' + (rawN === 1 ? '' : 's') + ' + ' + formulaN + ' formula feature' + (formulaN === 1 ? '' : 's');
  const raw = document.getElementById('bw-raw-count');
  if (raw) raw.textContent = rawN + ' selected';
  const hint = document.getElementById('bw-feat-hint');
  if (hint) hint.textContent = label;
  const sum = document.getElementById('bw-sum-feats');
  if (sum) sum.textContent = label;
  const quick = document.getElementById('bw-quick-feats');
  if (quick) quick.textContent = rawN + ' raw + ' + formulaN + ' formula';
  bwUpdatePackagePreview();
}
function bwMockAddSignal() {
  showToast('Additional signal picker is ready for backend wiring.', 'info');
}
async function bwHandleRecipeUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const name = document.getElementById('bw-recipe-file');
  const size = document.getElementById('bw-recipe-size');
  const status = document.getElementById('bw-formula-status');
  if (name) name.textContent = file.name;
  if (size) size.textContent = Math.max(1, Math.round(file.size / 1024)) + ' KB';
  try {
    BW.featureRecipeText = await file.text();
    BW.featureRecipeName = file.name;
    const count = bwCountSchemaFeatures(BW.featureRecipeText);
    const countEl = document.getElementById('bw-formula-count');
    if (countEl && count > 0) countEl.textContent = count;
    if (status) status.textContent = count > 0 ? 'Ready to compute' : 'Schema needs features';
    bwUpdateFeatureSummary();
    showToast('Feature schema loaded: ' + file.name, count > 0 ? 'success' : 'info');
  } catch (_) {
    if (status) status.textContent = 'Read failed';
    showToast('Feature schema could not be read.', 'error');
  }
}
function bwConfirmFeatures() {
  const status = document.getElementById('bw-formula-status');
  if (status) status.textContent = 'Computed';
  document.querySelectorAll('.bw-recipe-steps li').forEach(li => li.classList.add('done'));
  bwUpdateFeatureSummary();
  showToast('Formula features added to training inputs.', 'success');
}
function bwToggleModel(el) {
  el.classList.toggle('selected');
  const names = [].slice.call(document.querySelectorAll('.bw-model-item.selected .bw-model-name')).map(s => s.textContent.trim());
  const s = document.getElementById('bw-sum-model');
  if (s) s.textContent = names.length === 0 ? 'None' : names.length <= 2 ? names.join(', ') : names.length + ' models';
  const quick = document.getElementById('bw-quick-model');
  if (quick) quick.textContent = names.length === 0 ? 'No model' : names.length <= 2 ? names.join(', ') : names.length + ' models';
  if (typeof bwUpdateProgress === 'function') bwUpdateProgress();
}
function bwPickDataset(row) {
  document.querySelectorAll('#bw-ds-table tbody tr').forEach(tr => tr.classList.remove('bw-rowsel'));
  document.querySelectorAll('#bw-ds-table .bw-radio').forEach(r => r.classList.remove('on'));
  row.classList.add('bw-rowsel');
  const r = row.querySelector('.bw-radio'); if (r) r.classList.add('on');
}
function bwTab(el) { bwSingle(el, '.bw-tab', 'active'); }
function bwJumpResultSection(el, id) {
  bwTab(el);
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function bwResultBasename(file) {
  const path = file.webkitRelativePath || file.name || '';
  return path.split('/').pop().toLowerCase();
}
function bwCsvFallback(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(v => String(v || '').trim())).map(r => {
    const out = {};
    header.forEach((h, i) => { out[h] = r[i] == null ? '' : r[i]; });
    return out;
  });
}
function bwParseCsvRows(text) {
  if (window.Papa && typeof Papa.parse === 'function') {
    const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
    return (result.data || []).filter(row => Object.values(row).some(v => String(v || '').trim()));
  }
  return bwCsvFallback(text);
}
function bwNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function bwFirst(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}
function bwNormalizePredictions(rows) {
  return rows.map(row => {
    const yTrue = bwNum(bwFirst(row, ['y_true', 'true', 'target', 'label', 'SOH', 'RUL']));
    const yPred = bwNum(bwFirst(row, ['y_pred', 'pred', 'prediction', 'estimate']));
    return {
      model: String(bwFirst(row, ['model', 'Model']) || 'Model').trim(),
      split: String(bwFirst(row, ['split', 'Split']) || 'test').trim().toLowerCase(),
      cell_id: String(bwFirst(row, ['cell_id', 'cell', 'battery_id', 'Battery']) || 'cell').trim(),
      cycle_id: bwNum(bwFirst(row, ['cycle_id', 'cycle', 'Cycle'])) ?? 0,
      y_true: yTrue,
      y_pred: yPred
    };
  }).filter(row => Number.isFinite(row.y_true) && Number.isFinite(row.y_pred));
}
function bwNormalizeMetricRows(rows) {
  return rows.map(row => ({
    model: String(bwFirst(row, ['model', 'Model']) || 'Model').trim(),
    split: String(bwFirst(row, ['split', 'Split']) || 'test').trim().toLowerCase(),
    mae: bwNum(bwFirst(row, ['mae', 'MAE'])),
    rmse: bwNum(bwFirst(row, ['rmse', 'RMSE'])),
    mape: bwNum(bwFirst(row, ['mape', 'MAPE'])),
    r2: bwNum(bwFirst(row, ['r2', 'R2', 'R²']))
  })).filter(row => row.model);
}
function bwNormalizePerCellRows(rows) {
  return rows.map(row => ({
    model: String(bwFirst(row, ['model', 'Model']) || 'Model').trim(),
    split: String(bwFirst(row, ['split', 'Split']) || 'test').trim().toLowerCase(),
    cell_id: String(bwFirst(row, ['cell_id', 'cell', 'battery_id', 'Battery']) || '').trim(),
    mae: bwNum(bwFirst(row, ['mae', 'MAE'])),
    rmse: bwNum(bwFirst(row, ['rmse', 'RMSE'])),
    mape: bwNum(bwFirst(row, ['mape', 'MAPE'])),
    r2: bwNum(bwFirst(row, ['r2', 'R2', 'R²']))
  })).filter(row => row.model && row.cell_id);
}
function bwMetricsFromPredictions(predictions, groupKeys) {
  const groups = new Map();
  predictions.forEach(row => {
    const key = groupKeys.map(k => row[k]).join('\u0001');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return Array.from(groups.entries()).map(([key, rows]) => {
    const parts = key.split('\u0001');
    const trueVals = rows.map(r => r.y_true);
    const predVals = rows.map(r => r.y_pred);
    const n = rows.length;
    const mae = trueVals.reduce((s, y, i) => s + Math.abs(y - predVals[i]), 0) / Math.max(1, n);
    const mse = trueVals.reduce((s, y, i) => s + Math.pow(y - predVals[i], 2), 0) / Math.max(1, n);
    const nz = trueVals.map((y, i) => Math.abs(y) > 1e-8 ? Math.abs((y - predVals[i]) / y) : null).filter(v => v != null);
    const mean = trueVals.reduce((s, y) => s + y, 0) / Math.max(1, n);
    const ssTot = trueVals.reduce((s, y) => s + Math.pow(y - mean, 2), 0);
    const ssRes = trueVals.reduce((s, y, i) => s + Math.pow(y - predVals[i], 2), 0);
    const out = { mae, rmse: Math.sqrt(mse), mape: nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : null, r2: ssTot > 0 ? 1 - ssRes / ssTot : null };
    groupKeys.forEach((k, i) => { out[k] = parts[i]; });
    return out;
  });
}
function bwUnique(values) {
  return Array.from(new Set(values.filter(v => v != null && String(v).trim() !== '')));
}
function bwPreferTest(splits) {
  return splits.slice().sort((a, b) => {
    const order = { test: 0, val: 1, validation: 1, train: 2 };
    return (order[a] ?? 9) - (order[b] ?? 9) || a.localeCompare(b);
  });
}
function bwFmtMetric(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (digits === 0) return String(Math.round(n));
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(digits);
}
function bwFmtMape(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pct = Math.abs(n) <= 1.5 ? n * 100 : n;
  return pct.toFixed(2) + '%';
}
function bwResultShortCell(cell) {
  const text = String(cell || 'cell');
  return text.length > 28 ? '...' + text.slice(-25) : text;
}
function bwBestMetricRows(results) {
  const rows = (results.metrics || []).filter(r => Number.isFinite(Number(r.rmse)));
  if (!rows.length) return [];
  const splits = bwUnique(rows.map(r => r.split));
  const primary = splits.includes('test') ? 'test' : bwPreferTest(splits)[0];
  return rows.filter(r => r.split === primary).sort((a, b) => Number(a.rmse) - Number(b.rmse));
}
function bwSetSelectOptions(sel, values, selected) {
  if (!sel) return;
  const safeValues = values.length ? values : ['—'];
  const pick = safeValues.includes(selected) ? selected : safeValues[0];
  sel.innerHTML = safeValues.map(v => '<option value="' + esc(v) + '"' + (v === pick ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
}
async function bwHandleOutputsUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const status = document.getElementById('bw-results-status');
  if (status) status.textContent = 'Reading ' + files.length + ' local files...';
  const targets = {};
  for (const file of files) {
    const base = bwResultBasename(file);
    if (['metrics.json', 'predictions.csv', 'per_cell_metrics.csv', 'training_log.csv', 'summary.md'].includes(base) && !targets[base]) {
      targets[base] = { file, text: await file.text() };
    }
  }
  try {
    const metricsJson = targets['metrics.json'] ? JSON.parse(targets['metrics.json'].text) : {};
    const predictions = targets['predictions.csv'] ? bwNormalizePredictions(bwParseCsvRows(targets['predictions.csv'].text)) : [];
    const metricRows = metricsJson.metrics ? bwNormalizeMetricRows(metricsJson.metrics) : bwMetricsFromPredictions(predictions, ['model', 'split']);
    const perCellRows = targets['per_cell_metrics.csv']
      ? bwNormalizePerCellRows(bwParseCsvRows(targets['per_cell_metrics.csv'].text))
      : bwMetricsFromPredictions(predictions, ['model', 'split', 'cell_id']);
    if (!metricRows.length && !predictions.length) throw new Error('No valid metrics or predictions found.');
    BW.results = {
      files: Object.keys(targets).sort(),
      metricsJson,
      metrics: metricRows,
      predictions,
      perCell: perCellRows.filter(row => row.cell_id),
      log: targets['training_log.csv'] ? targets['training_log.csv'].text : ''
    };
    bwRenderResults();
    if (typeof showToast === 'function') showToast('Outputs loaded: ' + BW.results.files.join(', '), 'success');
  } catch (err) {
    if (status) status.textContent = 'Could not parse outputs: ' + err.message;
    if (typeof showToast === 'function') showToast('Could not parse outputs: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}
function bwClearResultsUpload() {
  BW.results = null;
  bwRenderResults();
}
function bwRenderResults() {
  const results = BW.results;
  bwRenderResultKpis(results);
  bwRenderLeaderboard(results);
  bwRenderEvidence(results);
  bwRenderResultControls(results);
  bwRenderResultsFigures();
  bwRenderResultFooter(results);
  const status = document.getElementById('bw-results-status');
  if (status) status.textContent = results ? ('Loaded ' + results.files.join(', ') + ' · ' + results.predictions.length + ' prediction rows') : 'No outputs loaded';
}
function bwRenderResultKpis(results) {
  const box = document.getElementById('bw-result-kpis');
  if (!box) return;
  if (!results) {
    box.innerHTML = [
      ['Best Model', '—', 'Upload outputs first'],
      ['Test RMSE', '—', 'Lower is better'],
      ['Worst Cell', '—', 'Per-cell RMSE'],
      ['Generalization Gap', '—', 'Test minus validation RMSE']
    ].map(item => '<div class="bw-rstat"><div class="bw-rstat-h">' + item[0] + '</div><div class="bw-rstat-v">' + item[1] + '</div><div class="bw-rstat-s">' + item[2] + '</div></div>').join('');
    return;
  }
  const bestRows = bwBestMetricRows(results);
  const best = bestRows[0] || {};
  const val = (results.metrics || []).find(r => r.model === best.model && (r.split === 'val' || r.split === 'validation'));
  const test = (results.metrics || []).find(r => r.model === best.model && r.split === 'test') || best;
  const gap = val && test ? Number(test.rmse) - Number(val.rmse) : null;
  const worst = (results.perCell || []).filter(r => r.model === best.model && r.split === (test.split || best.split)).sort((a, b) => Number(b.rmse) - Number(a.rmse))[0];
  const cards = [
    ['Best Model', best.model || '—', best.rmse != null ? 'RMSE ' + bwFmtMetric(best.rmse) + ' on ' + best.split : 'No metric row'],
    ['Test RMSE', bwFmtMetric(test.rmse), 'MAE ' + bwFmtMetric(test.mae) + ' · R2 ' + bwFmtMetric(test.r2, 3)],
    ['Worst Cell', worst ? bwResultShortCell(worst.cell_id) : '—', worst ? 'RMSE ' + bwFmtMetric(worst.rmse) : 'Upload per-cell metrics'],
    ['Generalization Gap', gap == null ? '—' : bwFmtMetric(gap), val ? 'test − val RMSE' : 'Validation split unavailable']
  ];
  box.innerHTML = cards.map((item, idx) => '<div class="bw-rstat"><div class="bw-rstat-h' + (idx === 2 ? ' bw-warn' : '') + '">' + esc(item[0]) + '</div><div class="bw-rstat-v' + (idx === 2 ? ' bw-warn-v' : '') + '">' + esc(item[1]) + '</div><div class="bw-rstat-s">' + esc(item[2]) + '</div></div>').join('');
}
function bwRenderLeaderboard(results) {
  const body = document.getElementById('bw-leaderboard-body');
  const splitLabel = document.getElementById('bw-leaderboard-split');
  if (!body) return;
  if (!results) {
    body.innerHTML = '<tr><td colspan="6" class="bw-empty-cell">Upload outputs to populate the leaderboard.</td></tr>';
    if (splitLabel) splitLabel.textContent = 'test split';
    return;
  }
  const rows = bwBestMetricRows(results);
  if (splitLabel && rows[0]) splitLabel.textContent = rows[0].split + ' split';
  body.innerHTML = rows.map((row, idx) => (
    '<tr' + (idx === 0 ? ' class="bw-lead-top"' : '') + '>' +
    '<td class="bw-mono">' + (idx + 1) + '</td>' +
    '<td class="bw-strong">' + esc(row.model) + '</td>' +
    '<td class="bw-mono">' + bwFmtMetric(row.rmse) + '</td>' +
    '<td class="bw-mono">' + bwFmtMetric(row.mae) + '</td>' +
    '<td class="bw-mono">' + bwFmtMape(row.mape) + '</td>' +
    '<td class="bw-mono">' + bwFmtMetric(row.r2, 3) + '</td>' +
    '</tr>'
  )).join('') || '<tr><td colspan="6" class="bw-empty-cell">No metric rows available.</td></tr>';
}
function bwRenderEvidence(results) {
  const list = document.getElementById('bw-evidence-list');
  if (!list) return;
  const metrics = results ? results.metricsJson || {} : {};
  const dataset = metrics.dataset || {};
  const task = metrics.task || {};
  const rows = [
    ['Dataset', dataset.ref_name || dataset.name || dataset.id || '—'],
    ['Task', task.name || task.key || '—'],
    ['Target', metrics.target_column || task.target_column || '—'],
    ['Prediction rows', results ? String(results.predictions.length) : '—'],
    ['Feature count', metrics.features ? String(metrics.features.length) : '—'],
    ['Files loaded', results ? results.files.length + ' files' : '—']
  ];
  list.innerHTML = rows.map(row => '<div><span>' + esc(row[0]) + '</span><b title="' + esc(row[1]) + '">' + esc(row[1]) + '</b></div>').join('');
}
function bwRenderResultControls(results) {
  const modelSel = document.getElementById('bw-result-model');
  const splitSel = document.getElementById('bw-result-split');
  if (!modelSel || !splitSel) return;
  if (!results) {
    bwSetSelectOptions(modelSel, ['No model'], 'No model');
    bwSetSelectOptions(splitSel, ['test'], 'test');
    bwSetSelectOptions(document.getElementById('bw-result-cell'), ['No cell'], 'No cell');
    return;
  }
  const best = bwBestMetricRows(results)[0];
  const models = bwUnique([...(results.predictions || []).map(r => r.model), ...(results.metrics || []).map(r => r.model)]).sort();
  const splits = bwPreferTest(bwUnique([...(results.predictions || []).map(r => r.split), ...(results.metrics || []).map(r => r.split)]));
  bwSetSelectOptions(modelSel, models, best ? best.model : modelSel.value);
  bwSetSelectOptions(splitSel, splits, best ? best.split : splitSel.value);
  bwUpdateResultCellOptions();
}
function bwUpdateResultCellOptions() {
  const results = BW.results;
  const modelSel = document.getElementById('bw-result-model');
  const splitSel = document.getElementById('bw-result-split');
  const cellSel = document.getElementById('bw-result-cell');
  if (!modelSel || !splitSel || !cellSel) return;
  const old = cellSel.value;
  if (!results) { bwSetSelectOptions(cellSel, ['No cell'], 'No cell'); return; }
  const model = modelSel.value;
  const split = splitSel.value;
  const cells = bwUnique(results.predictions.filter(r => r.model === model && r.split === split).map(r => r.cell_id)).sort();
  bwSetSelectOptions(cellSel, cells, old);
}
function bwRenderResultsFigures() {
  const results = BW.results;
  bwUpdateResultCellOptions();
  const curve = document.getElementById('bw-curve-chart');
  const scatter = document.getElementById('bw-scatter-chart');
  const errors = document.getElementById('bw-error-chart');
  if (!results) {
    if (curve) curve.innerHTML = '<div class="bw-empty-plot">Upload predictions.csv to render the trajectory.</div>';
    if (scatter) scatter.innerHTML = '<div class="bw-empty-plot">Upload predictions.csv to render the scatter plot.</div>';
    if (errors) errors.innerHTML = '<div class="bw-empty-plot">Upload per_cell_metrics.csv or predictions.csv to render per-cell errors.</div>';
    return;
  }
  const model = document.getElementById('bw-result-model')?.value;
  const split = document.getElementById('bw-result-split')?.value;
  const cell = document.getElementById('bw-result-cell')?.value;
  const target = results.metricsJson?.target_column || results.metricsJson?.task?.target_column || 'target';
  const cellRows = results.predictions.filter(r => r.model === model && r.split === split && r.cell_id === cell).sort((a, b) => Number(a.cycle_id) - Number(b.cycle_id));
  const splitRows = results.predictions.filter(r => r.model === model && r.split === split);
  const perCell = results.perCell.filter(r => r.model === model && r.split === split);
  const title = document.getElementById('bw-curve-title');
  if (title) title.textContent = target + ' Prediction Trajectory';
  if (curve) curve.innerHTML = cellRows.length ? bwLineChartSvg(cellRows, target, cell) : '<div class="bw-empty-plot">No prediction rows for this model, split, and cell.</div>';
  if (scatter) scatter.innerHTML = splitRows.length ? bwScatterSvg(splitRows, target) : '<div class="bw-empty-plot">No prediction rows for this model and split.</div>';
  if (errors) errors.innerHTML = perCell.length ? bwErrorBarsSvg(perCell) : '<div class="bw-empty-plot">No per-cell rows for this model and split.</div>';
  const note = document.getElementById('bw-scatter-note');
  if (note) note.textContent = split + ' split';
}
function bwDownsample(rows, maxPoints) {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
}
function bwDomain(values, pad = 0.04) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return [0, 1];
  let min = Math.min(...nums), max = Math.max(...nums);
  if (min === max) { min -= 0.5; max += 0.5; }
  const p = (max - min) * pad;
  return [min - p, max + p];
}
function bwTicks(min, max, count) {
  return Array.from({ length: count }, (_, i) => min + (max - min) * i / Math.max(1, count - 1));
}
function bwLineChartSvg(rows, target, cell) {
  const data = bwDownsample(rows, 520);
  const w = 620, h = 330, l = 62, r = 20, t = 22, b = 48;
  const [xMin, xMax] = bwDomain(data.map(d => d.cycle_id), 0);
  const [yMin, yMax] = bwDomain(data.flatMap(d => [d.y_true, d.y_pred]), 0.06);
  const x = v => l + (Number(v) - xMin) / (xMax - xMin || 1) * (w - l - r);
  const y = v => t + (yMax - Number(v)) / (yMax - yMin || 1) * (h - t - b);
  const truePts = data.map(d => x(d.cycle_id).toFixed(1) + ',' + y(d.y_true).toFixed(1)).join(' ');
  const predPts = data.map(d => x(d.cycle_id).toFixed(1) + ',' + y(d.y_pred).toFixed(1)).join(' ');
  const yTicks = bwTicks(yMin, yMax, 5);
  const xTicks = bwTicks(xMin, xMax, 5);
  return '<svg class="bw-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
    yTicks.map(v => '<line class="bw-plot-grid" x1="' + l + '" y1="' + y(v).toFixed(1) + '" x2="' + (w - r) + '" y2="' + y(v).toFixed(1) + '"/><text class="bw-plot-label" x="' + (l - 10) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + bwFmtMetric(v, 3) + '</text>').join('') +
    xTicks.map(v => '<text class="bw-plot-label" x="' + x(v).toFixed(1) + '" y="' + (h - 20) + '" text-anchor="middle">' + bwFmtMetric(v, 0) + '</text>').join('') +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + t + '" x2="' + l + '" y2="' + (h - b) + '"/>' +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + (h - b) + '" x2="' + (w - r) + '" y2="' + (h - b) + '"/>' +
    '<polyline fill="none" stroke="var(--text1)" stroke-width="2.3" points="' + truePts + '"/>' +
    '<polyline fill="none" stroke="var(--accent)" stroke-width="2.1" stroke-dasharray="5 4" points="' + predPts + '"/>' +
    '<text class="bw-plot-label" x="' + ((w + l - r) / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">Cycle</text>' +
    '<text class="bw-plot-label" x="15" y="' + ((h - b + t) / 2).toFixed(1) + '" text-anchor="middle" transform="rotate(-90 15 ' + ((h - b + t) / 2).toFixed(1) + ')">' + esc(target) + '</text>' +
    '<text class="bw-plot-note" x="' + (w - r) + '" y="16" text-anchor="end">' + esc(bwResultShortCell(cell)) + '</text>' +
    '</svg>';
}
function bwScatterSvg(rows, target) {
  const data = bwDownsample(rows, 900);
  const w = 620, h = 330, l = 62, r = 22, t = 22, b = 48;
  const [min, max] = bwDomain(data.flatMap(d => [d.y_true, d.y_pred]), 0.06);
  const x = v => l + (Number(v) - min) / (max - min || 1) * (w - l - r);
  const y = v => t + (max - Number(v)) / (max - min || 1) * (h - t - b);
  const ticks = bwTicks(min, max, 5);
  const points = data.map(d => '<circle cx="' + x(d.y_true).toFixed(1) + '" cy="' + y(d.y_pred).toFixed(1) + '" r="2.3" fill="var(--accent)" fill-opacity=".45"/>').join('');
  return '<svg class="bw-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
    ticks.map(v => '<line class="bw-plot-grid" x1="' + l + '" y1="' + y(v).toFixed(1) + '" x2="' + (w - r) + '" y2="' + y(v).toFixed(1) + '"/><line class="bw-plot-grid" x1="' + x(v).toFixed(1) + '" y1="' + t + '" x2="' + x(v).toFixed(1) + '" y2="' + (h - b) + '"/><text class="bw-plot-label" x="' + (l - 10) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + bwFmtMetric(v, 3) + '</text><text class="bw-plot-label" x="' + x(v).toFixed(1) + '" y="' + (h - 20) + '" text-anchor="middle">' + bwFmtMetric(v, 3) + '</text>').join('') +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + t + '" x2="' + l + '" y2="' + (h - b) + '"/>' +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + (h - b) + '" x2="' + (w - r) + '" y2="' + (h - b) + '"/>' +
    '<line x1="' + x(min).toFixed(1) + '" y1="' + y(min).toFixed(1) + '" x2="' + x(max).toFixed(1) + '" y2="' + y(max).toFixed(1) + '" stroke="var(--text1)" stroke-width="1.5" stroke-dasharray="5 4"/>' +
    points +
    '<text class="bw-plot-label" x="' + ((w + l - r) / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">Ground truth ' + esc(target) + '</text>' +
    '<text class="bw-plot-label" x="15" y="' + ((h - b + t) / 2).toFixed(1) + '" text-anchor="middle" transform="rotate(-90 15 ' + ((h - b + t) / 2).toFixed(1) + ')">Predicted ' + esc(target) + '</text>' +
    '<text class="bw-plot-note" x="' + (w - r) + '" y="16" text-anchor="end">diagonal: ideal prediction</text>' +
    '</svg>';
}
function bwErrorBarsSvg(rows) {
  const data = rows.slice().filter(r => Number.isFinite(Number(r.rmse))).sort((a, b) => Number(b.rmse) - Number(a.rmse)).slice(0, 12);
  const w = 620, h = Math.max(300, 70 + data.length * 22), l = 190, r = 34, t = 26, b = 34;
  const max = Math.max(...data.map(d => Number(d.rmse)), 1e-8);
  const barH = 14;
  const x = v => l + Number(v) / max * (w - l - r);
  const bars = data.map((d, i) => {
    const y = t + i * 22;
    const color = i === 0 ? 'var(--red)' : 'var(--accent)';
    return '<text class="bw-bar-label" x="' + (l - 8) + '" y="' + (y + 11) + '" text-anchor="end">' + esc(bwResultShortCell(d.cell_id)) + '</text>' +
      '<rect x="' + l + '" y="' + y + '" width="' + Math.max(2, x(d.rmse) - l).toFixed(1) + '" height="' + barH + '" rx="3" fill="' + color + '" fill-opacity="' + (i === 0 ? '.9' : '.72') + '"/>' +
      '<text class="bw-plot-label" x="' + (x(d.rmse) + 6).toFixed(1) + '" y="' + (y + 11) + '">' + bwFmtMetric(d.rmse) + '</text>';
  }).join('');
  return '<svg class="bw-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + (t - 8) + '" x2="' + l + '" y2="' + (h - b) + '"/>' +
    '<line class="bw-plot-axis" x1="' + l + '" y1="' + (h - b) + '" x2="' + (w - r) + '" y2="' + (h - b) + '"/>' +
    bars +
    '<text class="bw-plot-label" x="' + ((w + l - r) / 2).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">RMSE</text>' +
    '</svg>';
}
function bwRenderResultFooter(results) {
  const fileEl = document.getElementById('bw-foot-files');
  const modelEl = document.getElementById('bw-foot-models');
  const splitEl = document.getElementById('bw-foot-splits');
  const statusEl = document.getElementById('bw-foot-status');
  const dot = document.getElementById('bw-foot-dot');
  if (fileEl) fileEl.textContent = results ? results.files.length + ' files' : '0 files';
  if (modelEl) modelEl.textContent = results ? bwUnique(results.metrics.map(r => r.model)).join(', ') : '—';
  if (splitEl) splitEl.textContent = results ? bwPreferTest(bwUnique(results.metrics.map(r => r.split))).join(', ') : '—';
  if (statusEl) statusEl.textContent = results ? 'Outputs loaded' : 'Waiting for outputs';
  if (dot) dot.className = results ? 'bw-dot-ok' : 'bw-dot-warn';
}
window.bwJumpResultSection = bwJumpResultSection;
window.bwHandleOutputsUpload = bwHandleOutputsUpload;
window.bwClearResultsUpload = bwClearResultsUpload;
window.bwRenderResultsFigures = bwRenderResultsFigures;

function bwQuality(d) {
  if (d.status === 'done' && d.qc === 'yes') return 'high';
  if (d.status === 'done' || d.status === 'wip') return 'med';
  return 'low';
}
function bwQLabel(q) { return q === 'high' ? 'High' : q === 'med' ? 'Medium' : 'Low'; }
function bwCellNum(d) { const n = parseInt(('' + d.cells).replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }

function bwPopulateFilters() {
  const chem = new Set(), form = new Set(), inst = new Set(), temp = new Set();
  DATASETS.forEach(d => {
    if (d.chemistry && d.chemistry !== 'Unknown') chem.add(d.chemistry);
    if (d.form && d.form !== '—') form.add(d.form);
    const s = extractSourceFromRef(d.ref_name); if (s) inst.add(s);
    const t = extractTempFromRef(d.ref_name); if (t != null) temp.add(t === 'multi' ? 'Multi' : t);
  });
  const fill = (id, label, opts) => {
    const sel = document.getElementById(id); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">' + label + '</option>' + opts.map(o => {
      const disp = id === 'bw-f-inst' ? String(o).replace(/_/g, ' ')
                 : (id === 'bw-f-temp' && o !== 'Multi') ? o + '°C' : o;
      return '<option value="' + esc(String(o)) + '">' + esc(String(disp)) + '</option>';
    }).join('');
    if (cur) sel.value = cur;
  };
  fill('bw-f-chem', 'Chemistry', [...chem].sort());
  fill('bw-f-form', 'Format', [...form].sort());
  fill('bw-f-inst', 'Institution', [...inst].sort());
  fill('bw-f-temp', 'Temperature', [...temp].sort((a, b) => (a === 'Multi' ? 1 : b === 'Multi' ? -1 : a - b)));
}

function bwFiltered() {
  return DATASETS.filter(d => {
    if (BW.f.chem && d.chemistry !== BW.f.chem) return false;
    if (BW.f.form && d.form !== BW.f.form) return false;
    if (BW.f.inst && extractSourceFromRef(d.ref_name) !== BW.f.inst) return false;
    if (BW.f.temp) { const t = extractTempFromRef(d.ref_name); const tv = (t === 'multi' ? 'Multi' : t); if (String(tv) !== String(BW.f.temp)) return false; }
    if (BW.f.q) { const hay = (d.name + ' ' + d.ref_name + ' ' + d.notes).toLowerCase(); if (!hay.includes(BW.f.q)) return false; }
    return true;
  });
}

function bwRenderDatasets() {
  const tb = document.getElementById('bw-ds-tbody'); if (!tb) return;
  const list = bwFiltered();
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / BW.pageSize));
  if (BW.page > pages) BW.page = 1;
  if (!BW.selId || !list.some(d => d.id === BW.selId)) BW.selId = list[0] ? list[0].id : null;
  const start = (BW.page - 1) * BW.pageSize;
  const slice = list.slice(start, start + BW.pageSize);
  tb.innerHTML = slice.map(d => {
    const q = bwQuality(d);
    const cyc = Number(d.cycles) > 0 ? Number(d.cycles).toLocaleString('en-US') : '—';
    return '<tr class="' + (d.id === BW.selId ? 'bw-rowsel' : '') + '" onclick="bwSelectDataset(\'' + d.id + '\')">'
      + '<td><span class="bw-radio' + (d.id === BW.selId ? ' on' : '') + '"></span></td>'
      + '<td class="bw-strong bw-dsname">' + esc(d.name) + '</td>'
      + '<td>' + esc(d.chemistry) + '</td><td>' + esc('' + d.cells) + '</td><td>' + cyc + '</td>'
      + '<td>' + esc(d.form) + '</td>'
      + '<td><span class="bw-q ' + q + '">' + bwQLabel(q) + '</span></td></tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--text3)">No datasets match these filters.</td></tr>';
  const info = document.getElementById('bw-pager-info');
  if (info) info.textContent = total ? (start + 1) + '–' + Math.min(start + BW.pageSize, total) + ' of ' + total + ' datasets' : '0 datasets';
  bwRenderPager(pages);
  const selD = DATASETS.find(d => d.id === BW.selId);
  if (selD) bwFillSelected(selD); else bwClearSelected();
}

function bwRenderPager(pages) {
  const box = document.getElementById('bw-pager-btns'); if (!box) return;
  let html = '<button class="bw-pg bw-pg-nav"' + (BW.page > 1 ? ' onclick="bwGoPage(' + (BW.page - 1) + ')"' : ' disabled') + '>‹</button>';
  const nums = []; for (let p = 1; p <= pages; p++) { if (p === 1 || p === pages || Math.abs(p - BW.page) <= 1) nums.push(p); }
  let last = 0;
  nums.forEach(p => {
    if (last && p - last > 1) html += '<span class="bw-pg-dots">…</span>';
    html += '<button class="bw-pg ' + (p === BW.page ? 'active' : '') + '" onclick="bwGoPage(' + p + ')">' + p + '</button>';
    last = p;
  });
  html += '<button class="bw-pg bw-pg-nav"' + (BW.page < pages ? ' onclick="bwGoPage(' + (BW.page + 1) + ')"' : ' disabled') + '>›</button>';
  box.innerHTML = html;
}
function bwGoPage(p) { BW.page = p; bwRenderDatasets(); }
function bwSelectDataset(id) { BW.selId = id; bwRenderDatasets(); }

function bwFillSelected(d) {
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const n = bwCellNum(d);
  setT('bw-sum-ds', d.name + (n ? ' (' + n + ' cells)' : ''));
  setT('bw-quick-ds', d.name);
  setT('bw-cell-dsname', d.name);
  setT('bw-cell-count', n ? n + ' cells' : '—');
  setT('bw-cell-sel', n ? n + ' selected' : '0 selected');
  setT('bw-cells-showlbl', 'All cells (' + n + ')');
  bwRenderCells(d, n);
  const cells = []; for (let i = 1; i <= n; i++) cells.push('B' + String(i).padStart(2, '0'));
  const tr = Math.round(n * 0.6), va = Math.round(n * 0.2);
  BW.split = { train: cells.slice(0, tr), val: cells.slice(tr, tr + va), test: cells.slice(tr + va), excluded: [] };
  if (BW.splitMode === 'random') bwShuffleSplit(); else bwRenderSplit();
}
function bwClearSelected() {
  ['bw-sum-ds','bw-cell-dsname','bw-cell-count','bw-cell-sel','bw-sum-splitn','bw-train-n','bw-val-n','bw-test-n'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; });
  const qd = document.getElementById('bw-quick-ds'); if (qd) qd.textContent = 'Select dataset';
  const qs = document.getElementById('bw-quick-split'); if (qs) qs.textContent = 'Manual split';
  ['bw-train-chips','bw-val-chips','bw-test-chips','bw-cells-tbody'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = ''; });
  if (typeof bwUpdateProgress === 'function') bwUpdateProgress();
}

function bwRenderCells(d, n) {
  const tb = document.getElementById('bw-cells-tbody'); if (!tb) return;
  const t = extractTempFromRef(d.ref_name);
  const tlabel = typeof t === 'number' ? t.toFixed(1) : '25.0';
  const cyc = Number(d.cycles) > 0 ? Number(d.cycles).toLocaleString('en-US') : '—';
  const rows = Math.min(n, 8);
  let html = '';
  for (let i = 0; i < rows; i++) {
    const id = 'B' + String(i + 1).padStart(2, '0');
    const cap = (5.00 - (i % 5) * 0.01).toFixed(2);
    const soh = (75 - i * 0.8).toFixed(1);
    html += '<tr><td><span class="bw-cb on"></span></td><td class="bw-mono">' + id + '</td><td>' + cap + '</td><td>' + cyc + '</td><td>' + tlabel + '</td><td>' + soh + '</td><td><span class="bw-q high">High</span></td></tr>';
  }
  tb.innerHTML = html || '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text3)">No cell-level data for this dataset.</td></tr>';
}

function bwRenderSplit(skipProgress) {
  const chip = (c, b) => '<span class="bw-cell ' + b + '" draggable="true" data-cell="' + c + '" data-bucket="' + b
    + '" ondragstart="bwDragStart(event)" ondragend="bwDragEnd(event)">' + c + '</span>';
  const setHTML = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const setAllHTML = (ids, h) => ids.forEach(id => setHTML(id, h));
  const setAllT = (ids, v) => ids.forEach(id => setT(id, v));
  ['train', 'val', 'test', 'excluded'].forEach(b => {
    const html = (BW.split[b] || []).map(c => chip(c, b)).join('');
    setAllHTML(['bw-' + b + '-chips', 'bwr-' + b + '-chips'], html);
  });
  const total = BW.split.train.length + BW.split.val.length + BW.split.test.length;
  const fallbackSplit = typeof BWR !== 'undefined' ? BWR.split : { train: 60, val: 20, test: 20 };
  const trainPct = total ? Math.round(BW.split.train.length / total * 100) : (fallbackSplit.train || 60);
  const valPct = total ? Math.round(BW.split.val.length / total * 100) : (fallbackSplit.val || 20);
  const testPct = Math.max(0, 100 - trainPct - valPct);
  const pcts = { train: trainPct, val: valPct, test: testPct };
  ['train', 'val', 'test'].forEach(b => {
    setAllT(['bw-' + b + '-n', 'bwr-' + b + '-n'], BW.split[b].length + ' cells');
    setAllT(['bw-' + b + '-pct', 'bwr-' + b + '-pct'], '(' + pcts[b] + '%)');
  });
  const exN = (BW.split.excluded || []).length;
  setAllT(['bw-excluded-n', 'bwr-excluded-n'], exN + ' cells');
  setT('bw-sum-splitn', total ? 'Train ' + BW.split.train.length + ' · Val ' + BW.split.val.length + ' · Test ' + BW.split.test.length : '—');
  setT('bw-quick-split', total ? BW.split.train.length + ' / ' + BW.split.val.length + ' / ' + BW.split.test.length + ' cells' : 'Manual split');
  setT('bw-sum-excl', exN ? exN + ' cells' : 'None');
  if (typeof BWR !== 'undefined') BWR.split = { ...pcts };
  BW.ratio = { ...pcts };
  const flow = document.getElementById('bw-flow');
  if (flow) {
    flow.style.setProperty('--train-pct', Math.max(5, pcts.train) + '%');
    flow.style.setProperty('--val-pct', Math.max(5, pcts.val) + '%');
    flow.style.setProperty('--test-pct', Math.max(5, pcts.test) + '%');
  }
  ['train', 'val', 'test'].forEach(key => {
    const input = document.getElementById('bwr-input-' + key);
    if (input && document.activeElement !== input) input.value = pcts[key];
  });
  if (!skipProgress && typeof bwUpdateProgress === 'function') bwUpdateProgress();
}

/* ── drag & drop: move cells between Train / Val / Test ── */
let bwDragCell = null;
function bwDragStart(e) {
  bwDragCell = { cell: e.target.dataset.cell, from: e.target.dataset.bucket };
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', e.target.dataset.cell); } catch (_) {}
}
function bwDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.bw-cellcol.dragover, .bw-excluded.dragover').forEach(z => z.classList.remove('dragover'));
}
function bwDragOver(e) {
  e.preventDefault();
  document.querySelectorAll('.bw-cellcol.dragover, .bw-excluded.dragover').forEach(z => { if (z !== e.currentTarget) z.classList.remove('dragover'); });
  e.currentTarget.classList.add('dragover');
  e.dataTransfer.dropEffect = 'move';
}
function bwDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  if (!bwDragCell) return;
  const to = e.currentTarget.dataset.bucket;
  const from = bwDragCell.from, cell = bwDragCell.cell;
  bwDragCell = null;
  if (!to || from === to) return;
  const i = BW.split[from].indexOf(cell);
  if (i > -1) BW.split[from].splice(i, 1);
  if (!BW.split[to].includes(cell)) BW.split[to].push(cell);
  BW.split[to].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  bwRenderSplit();
}

/* ── step progress: mark each step done as its inputs get completed ── */
function bwUpdateProgress() {
  const steps = document.querySelectorAll('.bw-progress .bw-pstep');
  if (!steps.length) return;
  const sel = BW.selId ? DATASETS.find(d => d.id === BW.selId) : null;
  const dsOk = !!sel && bwCellNum(sel) > 0;
  const splitOk = dsOk && BW.split.train.length > 0 && BW.split.val.length > 0 && BW.split.test.length > 0;
  const modelOk = document.querySelectorAll('.bw-model-item.selected').length > 0;
  if (!(dsOk && splitOk && modelOk)) {
    bwHasRun = false;
    bwPackageExported = false;
  }
  const packageOk = dsOk && splitOk && modelOk;
  const done = [dsOk, splitOk, modelOk, bwPackageExported, bwHasRun];
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  let activeIdx = -1;
  for (let i = 0; i < done.length; i++) { if (!done[i]) { activeIdx = i; break; } }
  steps.forEach((st, i) => {
    st.classList.remove('done', 'active');
    const num = st.querySelector('.bw-pnum');
    if (done[i]) { st.classList.add('done'); if (num) num.innerHTML = check; }
    else { if (num) num.textContent = String(i + 1); if (i === activeIdx) st.classList.add('active'); }
  });
  document.querySelectorAll('.bw-progress .bw-pline').forEach((ln, i) => ln.classList.toggle('done', !!done[i]));
  const runBtn = document.querySelector('.bw-run');
  if (runBtn) runBtn.disabled = !(dsOk && splitOk && modelOk);
  document.querySelectorAll('.bw-download').forEach(btn => { btn.disabled = !packageOk; });
  bwUpdatePackagePreview();
}

function bwSlug(value, fallback) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || fallback || 'run';
}
function bwSafePathName(value, fallback) {
  const s = String(value || '').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  return s || fallback || 'dataset';
}
function bwDatasetFolderName(sel) {
  if (!sel) return 'YYYY_Source_Chemistry_FormFactor_Protocol';
  return bwSafePathName(sel.ref_name || sel.id || sel.name, sel.id || 'dataset');
}
function bwTaskKey() {
  const label = ((document.getElementById('bw-sum-task') || {}).textContent || 'SOH Estimation').toLowerCase();
  return label.includes('rul') ? 'rul' : 'soh';
}
function bwSelectedModels() {
  return [].slice.call(document.querySelectorAll('.bw-model-item.selected .bw-model-name'))
    .map(el => el.textContent.trim())
    .filter(Boolean);
}
function bwSelectedRawSignals() {
  return [].slice.call(document.querySelectorAll('#bw-feats .bw-feat.selected'))
    .map(el => el.dataset.name || el.textContent.replace('x', '').trim())
    .filter(Boolean);
}
function bwPackageInfo(sel) {
  const models = bwSelectedModels();
  const modelSlug = models.length ? bwSlug(models.join('_'), 'model') : 'model';
  const datasetName = bwDatasetFolderName(sel);
  const root = 'bt_benchmark_' + datasetName + '_' + bwTaskKey() + '_' + modelSlug;
  return { root: root, zip: root + '.zip', models: models };
}
function bwUpdatePackagePreview() {
  const sel = BW.selId ? DATASETS.find(d => d.id === BW.selId) : null;
  const info = bwPackageInfo(sel);
  const datasetFolder = bwDatasetFolderName(sel);
  const fileEl = document.getElementById('bw-package-filename');
  if (fileEl) fileEl.textContent = info.zip;
  const dataFolder = document.getElementById('bw-data-folder');
  if (dataFolder) {
    const path = 'data/' + datasetFolder + '/';
    dataFolder.textContent = path;
    dataFolder.title = path;
  }
  const cmd = document.getElementById('bw-terminal-command');
  if (cmd) {
    cmd.textContent = [
      'unzip ' + info.zip,
      'cd ' + info.root,
      'mkdir -p data',
      '# copy the whole processed dataset folder into data/ first',
      '# example: cp -R /path/to/' + datasetFolder + ' data/',
      'python3 -m venv .venv',
      'source .venv/bin/activate',
      'pip install -r requirements.txt',
      'bash run_benchmark.sh'
    ].join('\n');
  }
}
function bwBuildManifest(sel) {
  const task = bwTaskKey();
  const models = bwSelectedModels();
  const info = bwPackageInfo(sel);
  const activeTotal = (BW.split.train || []).length + (BW.split.val || []).length + (BW.split.test || []).length;
  const ratioFromCount = (n, fallback) => activeTotal ? +(n / activeTotal).toFixed(6) : fallback;
  const split = {
    mode: 'ratio_by_cell',
    source: 'web_train_val_test_ratio',
    seed: 42,
    ratios: {
      train: ratioFromCount((BW.split.train || []).length, 0.6),
      val: ratioFromCount((BW.split.val || []).length, 0.2),
      test: ratioFromCount((BW.split.test || []).length, 0.2)
    },
    web_mode: BW.splitMode,
    train: (BW.split.train || []).slice(),
    val: (BW.split.val || []).slice(),
    test: (BW.split.test || []).slice(),
    excluded: (BW.split.excluded || []).slice()
  };
  return {
    package_name: info.root,
    generated_by: 'BatteryLake Benchmark',
    generated_at: new Date().toISOString(),
    dataset: {
      id: sel.id,
      name: sel.name,
      ref_name: sel.ref_name,
      chemistry: sel.chemistry,
      form_factor: sel.form,
      cells: bwCellNum(sel),
      cycles: Number(sel.cycles) || null,
      notes: sel.notes || ''
    },
    task: {
      name: task === 'rul' ? 'RUL Prediction' : 'SOH Estimation',
      key: task,
      target_column: task === 'rul' ? 'RUL' : 'SOH',
      eol_threshold: 0.8,
      primary_metric: 'RMSE',
      metrics: ['RMSE', 'MAE', 'MAPE', 'R2']
    },
    features: {
      raw_signals: bwSelectedRawSignals(),
      formula_feature_count: parseInt((document.getElementById('bw-formula-count') || {}).textContent, 10) || 0,
      cycle_summary_first: true,
      timeseries_optional: true
    },
    models: models,
    split: split,
    data_contract: {
      user_supplied_data: true,
      expected_root: 'data/',
      metadata_pattern: '**/*metadata*.csv',
      cycle_summary_pattern: '**/*cycle_summary*.csv',
      timeseries_pattern: '**/*timeseries*.csv',
      required_timeseries_columns: ['cell_id', 'cycle_id', 'time_s', 'voltage_V', 'current_A', 'temperature_C'],
      required_cycle_summary_columns: ['cell_id', 'cycle_id', task === 'rul' ? 'RUL' : 'SOH'],
      optional_cycle_summary_columns: ['temperature_avg_C', 'internal_resistance_Ohm', 'capacity_Ah', 'discharge_capacity_Ah']
    }
  };
}
function bwDefaultFeatureSchema() {
  return [
    '# BatteryLake feature schema v2',
    '# One formula per line: feature_name = formula',
    '# Intermediate vector variables are supported; only scalar formulas are written to features.csv.',
    '# Use window = 4.0 <= voltage_V <= 4.2 to restrict each cycle before feature computation.',
    '# Source columns: time_s, voltage_V, current_A, temperature_C',
    '# Formula context: column arrays, previously computed features, n, and safe functions.',
    '# Supported functions: sum, mean, std, median, quantile, min, max, first, last, integral,',
    '# entropy, gradient, diff, where, duration_where, mean_where, min_where, max_where,',
    '# integral_where, sqrt, log, exp, abs',
    '',
    'window = 4.0 <= voltage_V <= 4.2',
    'voltage_mean = (1 / n) * sum(voltage_V)',
    'voltage_std = sqrt((1 / (n - 1)) * sum((voltage_V - voltage_mean)^2))',
    'voltage_kurtosis = sum((voltage_V - voltage_mean)^4) / ((n - 1) * voltage_std^4)',
    'voltage_skewness = sum((voltage_V - voltage_mean)^3) / ((n - 1) * voltage_std^3)',
    'charge_time_s = last(time_s) - first(time_s)',
    'accumulated_charge_Ah = integral(current_A, time_s) / 3600',
    'voltage_slope = (last(voltage_V) - first(voltage_V)) / (last(time_s) - first(time_s))',
    'voltage_entropy = entropy(voltage_V, bins=20)',
    'current_mean = (1 / n) * sum(current_A)',
    'current_std = sqrt((1 / (n - 1)) * sum((current_A - current_mean)^2))',
    'temperature_mean = (1 / n) * sum(temperature_C)',
    'temperature_max = max(temperature_C)'
  ].join('\n') + '\n';
}
function bwFeatureSchemaText() {
  return BW.featureRecipeText || bwDefaultFeatureSchema();
}
function bwCountSchemaFeatures(text) {
  let count = 0;
  String(text || '').split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    if (/^\[.+\]$/.test(s)) return;
    if (s.includes('=') && !/^(window|mode)\s*=/.test(s.toLowerCase())) count++;
  });
  return count;
}
function bwReadmeMd(manifest) {
  const datasetFolder = bwSafePathName((manifest.dataset || {}).ref_name || (manifest.dataset || {}).id || (manifest.dataset || {}).name, 'YYYY_Source_Chemistry_FormFactor_Protocol');
  return [
    '# BatteryLake Benchmark Training Package',
    '',
    'This package is generated from the BatteryLake Benchmark page. It does not include dataset files.',
    '',
    '## 1. Put the dataset folder in place',
    '',
    'Copy the whole processed BatteryLake dataset folder into `data/`. Do not extract CSV files one by one. The scripts search recursively under `data/`, so the original processed dataset folder structure can stay unchanged.',
    '',
    'Example:',
    '',
    '```bash',
    'mkdir -p data',
    'cp -R /path/to/' + datasetFolder + ' data/',
    '```',
    '',
    'Expected layout after copying:',
    '',
    '```text',
    'data/',
    '  ' + datasetFolder + '/',
    '    ... keep the processed dataset files exactly as exported',
    '```',
    '',
    'You do not need to create separate train, validation, or test folders. `split.json` stores the cell split selected on the Benchmark page, and the scripts use it automatically.',
    '',
    'Required time-series columns:',
    '',
    '- `cell_id`',
    '- `cycle_id` or `cycle_index`',
    '- `time_s`',
    '- `voltage_V`',
    '- `current_A`',
    '- `temperature_C`',
    '',
    'Required cycle-summary columns:',
    '',
    '- `cell_id`',
    '- `cycle_id` or `cycle_index`',
    '- `' + manifest.task.target_column + '` for this selected task, or a positive capacity column so the script can derive SOH/RUL',
    '',
    'The scripts compute features from time-series current, voltage, and temperature using `features/feature_schema.txt`, then merge the features back with cycle-summary labels. If SOH/RUL is empty, the split script derives SOH from each cell capacity normalized by its maximum positive capacity, and derives RUL from the first SOH <= 0.8 cycle.',
    '',
    '## 2. Feature schema',
    '',
    'Edit `features/feature_schema.txt` to define the voltage window and cycle-level features. One line is one formula:',
    '',
    '```text',
    'window = 4.0 <= voltage_V <= 4.2',
    'voltage_mean = (1 / n) * sum(voltage_V)',
    'voltage_std = sqrt((1 / (n - 1)) * sum((voltage_V - voltage_mean)^2))',
    'accumulated_charge_Ah = integral(current_A, time_s) / 3600',
    'voltage_entropy = entropy(voltage_V, bins=20)',
    '```',
    '',
    '## 3. Compute features, split, and run locally',
    '',
    '```bash',
    'python3 -m venv .venv',
    'source .venv/bin/activate',
    'pip install -r requirements.txt',
    'bash run_benchmark.sh',
    '```',
    '',
    '`run_benchmark.sh` first writes `features/features.csv` from the time-series files, then writes `splits/train.csv`, `splits/val.csv`, and `splits/test.csv` from the web-selected train/validation/test ratio. The model training script reads those split files directly.',
    '',
    '## 4. Selected benchmark',
    '',
    '- Dataset: ' + manifest.dataset.name + ' (`' + manifest.dataset.id + '`)',
    '- Task: ' + manifest.task.name,
    '- Models: ' + (manifest.models.join(', ') || 'Linear Regression'),
    '- Web split ratio: train ' + Math.round(manifest.split.ratios.train * 100) + '%, validation ' + Math.round(manifest.split.ratios.val * 100) + '%, test ' + Math.round(manifest.split.ratios.test * 100) + '%',
    '',
    '## 5. Outputs',
    '',
    'The scripts write:',
    '',
    '- `features/features.csv`',
    '- `outputs/metrics.json`',
    '- `outputs/predictions.csv`',
    '- `outputs/per_cell_metrics.csv`',
    '- `outputs/training_log.csv`',
    '- `outputs/summary.md`',
    '- `outputs/*.joblib` for scikit-learn models and `outputs/*.pt` for PyTorch models',
    '- `splits/train.csv`, `splits/val.csv`, `splits/test.csv`',
    '',
    '## Notes',
    '',
    'The current scaffold separates feature computation, split generation, and model training. Classical models are trained with scikit-learn. LSTM, CNN, MLP, PINN, and Transformer selections are trained with the PyTorch baseline implementations under `models/` using sliding cell/cycle feature sequences.'
  ].join('\n') + '\n';
}
function bwDataloaderPy() {
  return [
    'from pathlib import Path',
    'import pandas as pd',
    'import numpy as np',
    '',
    'def _csvs(data_root, marker):',
    '    root = Path(data_root)',
    '    return sorted([p for p in root.rglob("*.csv") if marker in p.name.lower()])',
    '',
    'def _processed_csvs(data_root):',
    '    files = _csvs(data_root, "cycle_summary")',
    '    if files:',
    '        return files',
    '    root = Path(data_root)',
    '    return sorted([',
    '        p for p in root.rglob("*.csv")',
    '        if "metadata" not in p.name.lower() and "timeseries" not in p.name.lower()',
    '    ])',
    '',
    'def target_column(config):',
    '    task = config.get("task", {})',
    '    if task.get("target_column"):',
    '        return task["target_column"]',
    '    return "RUL" if task.get("key") == "rul" else "SOH"',
    '',
    'def _capacity_column(frame):',
    '    for col in ["capacity_Ah", "discharge_capacity_Ah", "charge_capacity_Ah"]:',
    '        if col in frame.columns and pd.to_numeric(frame[col], errors="coerce").notna().any():',
    '            return col',
    '    return None',
    '',
    'def add_derived_targets(frame, eol_threshold=0.8):',
    '    data = frame.copy()',
    '    cap_col = _capacity_column(data)',
    '    if cap_col is None or "cell_id" not in data.columns or "cycle_id" not in data.columns:',
    '        return data',
    '    cap = pd.to_numeric(data[cap_col], errors="coerce")',
    '    valid_cap = cap.where(cap > 0)',
    '    baseline = valid_cap.groupby(data["cell_id"].astype(str)).transform(lambda s: s.dropna().max() if s.dropna().size else np.nan)',
    '    derived_soh = valid_cap / baseline',
    '    if "SOH" not in data.columns:',
    '        data["SOH"] = np.nan',
    '    soh_existing = pd.to_numeric(data["SOH"], errors="coerce")',
    '    data["SOH"] = soh_existing.where(soh_existing.notna(), derived_soh)',
    '    if "RUL" not in data.columns:',
    '        data["RUL"] = np.nan',
    '    rul_existing = pd.to_numeric(data["RUL"], errors="coerce")',
    '    derived_rul = pd.Series(np.nan, index=data.index, dtype=float)',
    '    temp = data[["cell_id", "cycle_id"]].copy()',
    '    temp["SOH"] = pd.to_numeric(data["SOH"], errors="coerce")',
    '    temp["cycle_id"] = pd.to_numeric(temp["cycle_id"], errors="coerce")',
    '    for _, group in temp.dropna(subset=["cycle_id"]).sort_values(["cell_id", "cycle_id"]).groupby(temp["cell_id"].astype(str), sort=False):',
    '        below = group[group["SOH"] <= float(eol_threshold)]',
    '        eol_cycle = below["cycle_id"].iloc[0] if len(below) else group["cycle_id"].max()',
    '        derived_rul.loc[group.index] = np.maximum(eol_cycle - group["cycle_id"], 0)',
    '    data["RUL"] = rul_existing.where(rul_existing.notna(), derived_rul)',
    '    return data',
    '',
    'def load_processed_frame(data_root):',
    '    files = _processed_csvs(data_root)',
    '    if not files:',
    '        raise FileNotFoundError("No processed training CSV files found under data/. Expected *_cycle_summary*.csv or processed feature CSV files.")',
    '    frames = []',
    '    for path in files:',
    '        df = pd.read_csv(path)',
    '        if "cell_id" not in df.columns:',
    '            raise ValueError("%s is missing required column cell_id." % path)',
    '        df["source_file"] = str(path)',
    '        frames.append(df)',
    '    data = pd.concat(frames, ignore_index=True)',
    '    if "cycle_id" not in data.columns and "cycle_index" in data.columns:',
    '        data = data.rename(columns={"cycle_index": "cycle_id"})',
    '    if "cycle_id" not in data.columns:',
    '        raise ValueError("Processed data must include cycle_id or cycle_index.")',
    '    return add_derived_targets(data)',
    '',
    'def feature_columns(frame, target):',
    '    excluded = {"cell_id", "source_file", "step_type", "cycle_end_flag", "SOH", "RUL", target, "capacity_Ah", "charge_capacity_Ah", "discharge_capacity_Ah"}',
    '    cols = []',
    '    for col in frame.columns:',
    '        if col in excluded:',
    '            continue',
    '        if pd.api.types.is_numeric_dtype(frame[col]) and frame[col].notna().any():',
    '            cols.append(col)',
    '    if "cycle_id" not in cols and "cycle_id" in frame.columns:',
    '        cols.insert(0, "cycle_id")',
    '    return cols',
    '',
    'def split_by_ratio(frame, split_config):',
    '    cells = np.array(sorted(frame["cell_id"].dropna().astype(str).unique()))',
    '    if len(cells) < 3:',
    '        raise ValueError("Need at least three cells for train/validation/test split; found %d." % len(cells))',
    '    seed = int(split_config.get("seed", 42))',
    '    rng = np.random.default_rng(seed)',
    '    rng.shuffle(cells)',
    '    ratios = split_config.get("ratios", {})',
    '    train_r = float(ratios.get("train", 0.6))',
    '    val_r = float(ratios.get("val", 0.2))',
    '    test_r = float(ratios.get("test", 0.2))',
    '    total_r = train_r + val_r + test_r',
    '    if total_r <= 0:',
    '        train_r, val_r, test_r, total_r = 0.6, 0.2, 0.2, 1.0',
    '    n = len(cells)',
    '    n_train = max(1, int(round(n * train_r / total_r)))',
    '    n_val = max(1, int(round(n * val_r / total_r)))',
    '    if n_train + n_val >= n:',
    '        n_train = max(1, n - 2)',
    '        n_val = 1',
    '    train_cells = set(cells[:n_train])',
    '    val_cells = set(cells[n_train:n_train + n_val])',
    '    test_cells = set(cells[n_train + n_val:])',
    '    parts = {',
    '        "train": frame[frame["cell_id"].astype(str).isin(train_cells)].copy(),',
    '        "val": frame[frame["cell_id"].astype(str).isin(val_cells)].copy(),',
    '        "test": frame[frame["cell_id"].astype(str).isin(test_cells)].copy(),',
    '    }',
    '    resolved = {',
    '        "mode": "ratio_by_cell",',
    '        "seed": seed,',
    '        "ratios": {"train": train_r / total_r, "val": val_r / total_r, "test": test_r / total_r},',
    '        "cells": {k: sorted(v["cell_id"].astype(str).unique().tolist()) for k, v in parts.items()},',
    '        "rows": {k: int(len(v)) for k, v in parts.items()}',
    '    }',
    '    return parts, resolved',
    '',
    'def write_split_files(parts, output_root):',
    '    output_root = Path(output_root)',
    '    output_root.mkdir(parents=True, exist_ok=True)',
    '    for name, df in parts.items():',
    '        df.to_csv(output_root / ("%s.csv" % name), index=False)',
    '',
    'def build_sequence_arrays(frame, target, feature_cols, sequence_length=8):',
    '    seq_len = max(1, int(sequence_length))',
    '    xs, ys, meta = [], [], []',
    '    data = frame.dropna(subset=["cell_id", "cycle_id", target]).copy()',
    '    data["cycle_id"] = pd.to_numeric(data["cycle_id"], errors="coerce")',
    '    data = data.dropna(subset=["cycle_id"]).sort_values(["cell_id", "cycle_id"])',
    '    for cell_id, group in data.groupby("cell_id", sort=True):',
    '        g = group.sort_values("cycle_id")',
    '        values = g[feature_cols].to_numpy(dtype=np.float32)',
    '        targets = g[target].to_numpy(dtype=np.float32)',
    '        cycles = g["cycle_id"].to_numpy()',
    '        for idx in range(len(g)):',
    '            start = max(0, idx - seq_len + 1)',
    '            window = values[start:idx + 1]',
    '            if len(window) < seq_len:',
    '                pad = np.repeat(window[:1], seq_len - len(window), axis=0)',
    '                window = np.vstack([pad, window])',
    '            xs.append(window)',
    '            ys.append(targets[idx])',
    '            meta.append({"cell_id": cell_id, "cycle_id": cycles[idx]})',
    '    if not xs:',
    '        raise ValueError("No sequence samples could be built from the split files.")',
    '    return np.stack(xs).astype(np.float32), np.asarray(ys, dtype=np.float32), pd.DataFrame(meta)',
    '',
    'def make_torch_loader(frame, target, feature_cols, sequence_length=8, batch_size=32, shuffle=False):',
    '    import torch',
    '    from torch.utils.data import DataLoader, TensorDataset',
    '    x, y, _ = build_sequence_arrays(frame, target, feature_cols, sequence_length)',
    '    dataset = TensorDataset(torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.float32))',
    '    return DataLoader(dataset, batch_size=int(batch_size), shuffle=bool(shuffle))'
  ].join('\n') + '\n';
}
function bwModelsPy() {
  return [
    'from sklearn.linear_model import LinearRegression, Ridge',
    'from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor',
    'from sklearn.neural_network import MLPRegressor',
    '',
    'def build_model(name, random_state=42):',
    '    key = name.lower().replace("-", " ")',
    '    adapter = None',
    '    if "linear" in key:',
    '        model = LinearRegression()',
    '    elif "random forest" in key or key == "rf":',
    '        model = RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=random_state, n_jobs=-1)',
    '    elif "xgboost" in key or "boost" in key:',
    '        model = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, random_state=random_state)',
    '        adapter = "sklearn_hist_gradient_boosting"',
    '    else:',
    '        model = MLPRegressor(hidden_layer_sizes=(128, 64), activation="relu", max_iter=500, random_state=random_state, early_stopping=True)',
    '        adapter = "mlp_scaffold_for_" + name.replace(" ", "_").lower()',
    '    return model, adapter'
  ].join('\n') + '\n';
}
function bwDatasetInterfacePy() {
  return `class BaseModel:
    def fit(self, train_loader, val_loader, config):
        raise NotImplementedError

    def predict(self, x):
        raise NotImplementedError

    def save(self, path):
        raise NotImplementedError

    def load(self, path):
        raise NotImplementedError
`;
}
function bwLstmPy() {
  return `import torch
import torch.nn as nn
import numpy as np
from copy import deepcopy
from dataset_interface import BaseModel

class LSTMCore(nn.Module):
    def __init__(self, input_dim=4, hidden_dim=64, num_layers=1):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers=num_layers, batch_first=True)
        self.mlp = nn.Linear(hidden_dim, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.mlp(out[:, -1, :]).squeeze(-1)

class LSTMModel(BaseModel):
    def __init__(self, config):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = config
        params = config.get("model_params", {})
        self.model = LSTMCore(**params).to(self.device)

    def fit(self, train_loader, val_loader, config):
        train_params = config.get("train_params", {})
        lr = train_params.get("learning_rate", 0.001)
        max_epochs = train_params.get("max_epochs", 200)
        patience = train_params.get("patience", 20)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        best_val_mae = float("inf")
        best_weights = None
        patience_counter = 0
        for epoch in range(max_epochs):
            self.model.train()
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
            val_mae = self._mae(val_loader)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"Epoch {epoch+1}/{max_epochs} | Val MAE: {val_mae:.4f}")
            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_weights = deepcopy(self.model.state_dict())
                patience_counter = 0
            else:
                patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}. Best Val MAE: {best_val_mae:.4f}")
                break
        if best_weights is not None:
            self.model.load_state_dict(best_weights)

    def _mae(self, loader):
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = self.model(batch_x.to(self.device))
                preds.append(outputs.cpu())
                targets.append(batch_y.cpu())
        return torch.mean(torch.abs(torch.cat(preds) - torch.cat(targets))).item()

    def predict(self, x: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            if x_tensor.dim() == 2:
                x_tensor = x_tensor.unsqueeze(0)
            return self.model(x_tensor).cpu().numpy()

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path)

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path, map_location=self.device))
`;
}
function bwCnnPy() {
  return `import torch
import torch.nn as nn
import numpy as np
from copy import deepcopy
from dataset_interface import BaseModel

class CNNCore(nn.Module):
    def __init__(self, input_dim=4, hidden_dim=64):
        super().__init__()
        self.conv = nn.Conv1d(input_dim, hidden_dim, kernel_size=3, padding=1)
        self.mlp = nn.Linear(hidden_dim, 1)

    def forward(self, x):
        x = x.transpose(1, 2)
        x = torch.relu(self.conv(x))
        x = torch.mean(x, dim=2)
        return self.mlp(x).squeeze(-1)

class CNNModel(BaseModel):
    def __init__(self, config):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = config
        params = config.get("model_params", {})
        self.model = CNNCore(**params).to(self.device)

    def fit(self, train_loader, val_loader, config):
        train_params = config.get("train_params", {})
        lr = train_params.get("learning_rate", 0.001)
        max_epochs = train_params.get("max_epochs", 200)
        patience = train_params.get("patience", 20)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        best_val_mae = float("inf")
        best_weights = None
        patience_counter = 0
        for epoch in range(max_epochs):
            self.model.train()
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
            val_mae = self._mae(val_loader)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"Epoch {epoch+1}/{max_epochs} | Val MAE: {val_mae:.4f}")
            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_weights = deepcopy(self.model.state_dict())
                patience_counter = 0
            else:
                patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}. Best Val MAE: {best_val_mae:.4f}")
                break
        if best_weights is not None:
            self.model.load_state_dict(best_weights)

    def _mae(self, loader):
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = self.model(batch_x.to(self.device))
                preds.append(outputs.cpu())
                targets.append(batch_y.cpu())
        return torch.mean(torch.abs(torch.cat(preds) - torch.cat(targets))).item()

    def predict(self, x: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            if x_tensor.dim() == 2:
                x_tensor = x_tensor.unsqueeze(0)
            return self.model(x_tensor).cpu().numpy()

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path)

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path, map_location=self.device))
`;
}
function bwMlpPy() {
  return `import torch
import torch.nn as nn
import numpy as np
from copy import deepcopy
from dataset_interface import BaseModel

class MLPCore(nn.Module):
    def __init__(self, input_dim=4, hidden_dim=64):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(input_dim * 3, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, x):
        mean_x = torch.mean(x, dim=1)
        std_x = torch.std(x, dim=1)
        max_x, _ = torch.max(x, dim=1)
        features = torch.cat([mean_x, std_x, max_x], dim=1)
        return self.mlp(features).squeeze(-1)

class MLPModel(BaseModel):
    def __init__(self, config):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = config
        params = config.get("model_params", {})
        self.model = MLPCore(**params).to(self.device)

    def fit(self, train_loader, val_loader, config):
        train_params = config.get("train_params", {})
        lr = train_params.get("learning_rate", 0.001)
        max_epochs = train_params.get("max_epochs", 200)
        patience = train_params.get("patience", 20)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        best_val_mae = float("inf")
        best_weights = None
        patience_counter = 0
        for epoch in range(max_epochs):
            self.model.train()
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
            val_mae = self._mae(val_loader)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"Epoch {epoch+1}/{max_epochs} | Val MAE: {val_mae:.4f}")
            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_weights = deepcopy(self.model.state_dict())
                patience_counter = 0
            else:
                patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}. Best Val MAE: {best_val_mae:.4f}")
                break
        if best_weights is not None:
            self.model.load_state_dict(best_weights)

    def _mae(self, loader):
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = self.model(batch_x.to(self.device))
                preds.append(outputs.cpu())
                targets.append(batch_y.cpu())
        return torch.mean(torch.abs(torch.cat(preds) - torch.cat(targets))).item()

    def predict(self, x: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            if x_tensor.dim() == 2:
                x_tensor = x_tensor.unsqueeze(0)
            return self.model(x_tensor).cpu().numpy()

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path)

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path, map_location=self.device))
`;
}
function bwPinnPy() {
  return `import torch
import torch.nn as nn
import numpy as np
from copy import deepcopy
from dataset_interface import BaseModel

class PINNCore(nn.Module):
    def __init__(self, input_dim=4, hidden_dim=64):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, x):
        return self.mlp(x[:, -1, :]).squeeze(-1)

class PINNModel(BaseModel):
    def __init__(self, config):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = config
        params = dict(config.get("model_params", {}))
        self.phys_lambda = float(params.pop("lambda", params.pop("phys_lambda", 0.1)))
        self.model = PINNCore(**params).to(self.device)

    def fit(self, train_loader, val_loader, config):
        train_params = config.get("train_params", {})
        lr = train_params.get("learning_rate", 0.001)
        max_epochs = train_params.get("max_epochs", 200)
        patience = train_params.get("patience", 20)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        best_val_mae = float("inf")
        best_weights = None
        patience_counter = 0
        for epoch in range(max_epochs):
            self.model.train()
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(batch_x)
                mse_loss = criterion(outputs, batch_y)
                physics_loss = torch.mean(torch.relu(outputs - 1.0))
                loss = mse_loss + self.phys_lambda * physics_loss
                loss.backward()
                optimizer.step()
            val_mae = self._mae(val_loader)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"Epoch {epoch+1}/{max_epochs} | Val MAE: {val_mae:.4f}")
            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_weights = deepcopy(self.model.state_dict())
                patience_counter = 0
            else:
                patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}. Best Val MAE: {best_val_mae:.4f}")
                break
        if best_weights is not None:
            self.model.load_state_dict(best_weights)

    def _mae(self, loader):
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = self.model(batch_x.to(self.device))
                preds.append(outputs.cpu())
                targets.append(batch_y.cpu())
        return torch.mean(torch.abs(torch.cat(preds) - torch.cat(targets))).item()

    def predict(self, x: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            if x_tensor.dim() == 2:
                x_tensor = x_tensor.unsqueeze(0)
            return self.model(x_tensor).cpu().numpy()

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path)

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path, map_location=self.device))
`;
}
function bwTransformerPy() {
  return `import torch
import torch.nn as nn
import numpy as np
from copy import deepcopy
from dataset_interface import BaseModel

class TransformerCore(nn.Module):
    def __init__(self, input_dim=4, d_model=64, nhead=4, num_layers=2):
        super().__init__()
        self.embedding = nn.Linear(input_dim, d_model)
        encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, batch_first=True)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.mlp = nn.Linear(d_model, 1)

    def forward(self, x):
        x = self.embedding(x)
        x = self.transformer(x)
        return self.mlp(x[:, -1, :]).squeeze(-1)

class TransformerModel(BaseModel):
    def __init__(self, config):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = config
        params = config.get("model_params", {})
        self.model = TransformerCore(**params).to(self.device)

    def fit(self, train_loader, val_loader, config):
        train_params = config.get("train_params", {})
        lr = train_params.get("learning_rate", 0.001)
        max_epochs = train_params.get("max_epochs", 200)
        patience = train_params.get("patience", 20)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        best_val_mae = float("inf")
        best_weights = None
        patience_counter = 0
        for epoch in range(max_epochs):
            self.model.train()
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
            val_mae = self._mae(val_loader)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"Epoch {epoch+1}/{max_epochs} | Val MAE: {val_mae:.4f}")
            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_weights = deepcopy(self.model.state_dict())
                patience_counter = 0
            else:
                patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch}. Best Val MAE: {best_val_mae:.4f}")
                break
        if best_weights is not None:
            self.model.load_state_dict(best_weights)

    def _mae(self, loader):
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = self.model(batch_x.to(self.device))
                preds.append(outputs.cpu())
                targets.append(batch_y.cpu())
        return torch.mean(torch.abs(torch.cat(preds) - torch.cat(targets))).item()

    def predict(self, x: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            if x_tensor.dim() == 2:
                x_tensor = x_tensor.unsqueeze(0)
            return self.model(x_tensor).cpu().numpy()

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path)

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path, map_location=self.device))
`;
}
function bwComputeFeaturesPy() {
  return [
    'import argparse',
    'import ast',
    'from pathlib import Path',
    'import numpy as np',
    'import pandas as pd',
    '',
    'ALIASES = {',
    '    "t": "time_s", "time": "time_s",',
    '    "v": "voltage_V", "voltage": "voltage_V",',
    '    "i": "current_A", "current": "current_A",',
    '    "temp": "temperature_C", "temperature": "temperature_C",',
    '}',
    '',
    'def resolve_col(name):',
    '    key = str(name).strip()',
    '    return ALIASES.get(key, key)',
    '',
    'def read_schema(path):',
    '    window_expr = None',
    '    formulas = []',
    '    for raw in Path(path).read_text(encoding="utf-8").splitlines():',
    '        line = raw.split("#", 1)[0].strip()',
    '        if not line:',
    '            continue',
    '        if line.startswith("[") and line.endswith("]"):',
    '            continue',
    '        if "=" not in line:',
    '            continue',
    '        key, value = [x.strip() for x in line.split("=", 1)]',
    '        if key.lower() == "window":',
    '            window_expr = value',
    '        elif key.lower() == "mode":',
    '            continue',
    '        else:',
    '            formulas.append((key, value))',
    '    if not formulas:',
    '        raise ValueError("Feature schema must contain at least one formula line: feature_name = formula.")',
    '    return window_expr, formulas',
    '',
    'def csvs(data_root, marker):',
    '    return sorted([p for p in Path(data_root).rglob("*.csv") if marker in p.name.lower()])',
    '',
    'def iter_timeseries_frames(data_root):',
    '    files = csvs(data_root, "timeseries")',
    '    if not files:',
    '        raise FileNotFoundError("No *_timeseries*.csv files found under data/.")',
    '    for path in files:',
    '        df = pd.read_csv(path)',
    '        if "cycle_id" not in df.columns and "cycle_index" in df.columns:',
    '            df = df.rename(columns={"cycle_index": "cycle_id"})',
    '        required = ["cell_id", "cycle_id", "time_s", "voltage_V", "current_A", "temperature_C"]',
    '        missing = [c for c in required if c not in df.columns]',
    '        if missing:',
    '            raise ValueError("%s missing required time-series columns: %s" % (path, ", ".join(missing)))',
    '        df["source_file"] = str(path)',
    '        numeric_required = ["cycle_id", "time_s", "voltage_V", "current_A", "temperature_C"]',
    '        for col in df.columns:',
    '            if col in ["cell_id", "source_file", "step_type"]:',
    '                continue',
    '            converted = pd.to_numeric(df[col], errors="coerce")',
    '            if col in numeric_required or converted.notna().any():',
    '                df[col] = converted',
    '        yield df.dropna(subset=["cell_id", "cycle_id", "time_s"])',
    '',
    'def load_cycle_summary(data_root):',
    '    files = csvs(data_root, "cycle_summary")',
    '    if not files:',
    '        return pd.DataFrame()',
    '    frames = []',
    '    for path in files:',
    '        df = pd.read_csv(path)',
    '        if "cycle_id" not in df.columns and "cycle_index" in df.columns:',
    '            df = df.rename(columns={"cycle_index": "cycle_id"})',
    '        if "cell_id" not in df.columns or "cycle_id" not in df.columns:',
    '            raise ValueError("%s must include cell_id and cycle_id." % path)',
    '        frames.append(df)',
    '    data = pd.concat(frames, ignore_index=True)',
    '    data["cycle_id"] = pd.to_numeric(data["cycle_id"], errors="coerce")',
    '    return data.dropna(subset=["cell_id", "cycle_id"])',
    '',
    'def clean_array(x):',
    '    arr = np.asarray(x, dtype=float)',
    '    return arr[np.isfinite(arr)]',
    '',
    'def as_array(x):',
    '    return np.asarray(x, dtype=float)',
    '',
    'def aligned_arrays(*items):',
    '    arrays = [as_array(item).reshape(-1) for item in items]',
    '    if not arrays:',
    '        return []',
    '    n = min(len(arr) for arr in arrays)',
    '    return [arr[:n] for arr in arrays]',
    '',
    'def scalarize(value):',
    '    if isinstance(value, np.ndarray):',
    '        if value.shape == ():',
    '            v = float(value)',
    '            return v if np.isfinite(v) else np.nan',
    '        if value.size == 1:',
    '            v = float(value.reshape(-1)[0])',
    '            return v if np.isfinite(v) else np.nan',
    '        raise ValueError("Formula returned an array. Use it as an intermediate variable or reduce it with sum/mean/min/max/first/last/integral/entropy.")',
    '    if isinstance(value, (np.floating, np.integer)):',
    '        v = float(value)',
    '        return v if np.isfinite(v) else np.nan',
    '    return value',
    '',
    'def fn_sum(x):',
    '    x = clean_array(x)',
    '    return float(np.sum(x)) if len(x) else np.nan',
    '',
    'def fn_mean(x):',
    '    x = clean_array(x)',
    '    return float(np.mean(x)) if len(x) else np.nan',
    '',
    'def fn_std(x):',
    '    x = clean_array(x)',
    '    return float(np.std(x, ddof=1)) if len(x) > 1 else np.nan',
    '',
    'def fn_median(x):',
    '    x = clean_array(x)',
    '    return float(np.median(x)) if len(x) else np.nan',
    '',
    'def fn_quantile(x, q):',
    '    x = clean_array(x)',
    '    return float(np.quantile(x, float(q))) if len(x) else np.nan',
    '',
    'def fn_min(x):',
    '    x = clean_array(x)',
    '    return float(np.min(x)) if len(x) else np.nan',
    '',
    'def fn_max(x):',
    '    x = clean_array(x)',
    '    return float(np.max(x)) if len(x) else np.nan',
    '',
    'def fn_first(x):',
    '    x = clean_array(x)',
    '    return float(x[0]) if len(x) else np.nan',
    '',
    'def fn_last(x):',
    '    x = clean_array(x)',
    '    return float(x[-1]) if len(x) else np.nan',
    '',
    'def fn_integral(y, x):',
    '    y, x = aligned_arrays(y, x)',
    '    mask = np.isfinite(y) & np.isfinite(x)',
    '    y = y[mask]',
    '    x = x[mask]',
    '    n = min(len(x), len(y))',
    '    if n < 2:',
    '        return np.nan',
    '    integral = np.trapezoid(y[:n], x[:n]) if hasattr(np, "trapezoid") else np.trapz(y[:n], x[:n])',
    '    return float(integral)',
    '',
    'def fn_entropy(x, bins=20):',
    '    x = clean_array(x)',
    '    if not len(x):',
    '        return np.nan',
    '    counts, _ = np.histogram(x, bins=int(bins))',
    '    p = counts[counts > 0] / max(np.sum(counts), 1)',
    '    return float(-np.sum(p * np.log(p))) if len(p) else np.nan',
    '',
    'def fn_gradient(y, x=None):',
    '    y = as_array(y).reshape(-1)',
    '    if x is None:',
    '        if len(y) < 2:',
    '            return np.full(len(y), np.nan, dtype=float)',
    '        return np.gradient(y)',
    '    y, x = aligned_arrays(y, x)',
    '    if len(y) < 2:',
    '        return np.full(len(y), np.nan, dtype=float)',
    '    if len(np.unique(x[np.isfinite(x)])) < 2:',
    '        return np.full(len(y), np.nan, dtype=float)',
    '    with np.errstate(divide="ignore", invalid="ignore"):',
    '        return np.gradient(y, x)',
    '',
    'def fn_diff(x):',
    '    x = as_array(x).reshape(-1)',
    '    return np.diff(x) if len(x) > 1 else np.asarray([np.nan])',
    '',
    'def fn_where(cond, a, b):',
    '    return np.where(np.asarray(cond, dtype=bool), a, b)',
    '',
    'def fn_duration_where(cond, x):',
    '    cond, x = aligned_arrays(np.asarray(cond, dtype=bool), x)',
    '    cond = cond.astype(bool)',
    '    if len(x) < 2:',
    '        return 0.0',
    '    mask = cond[:-1] & cond[1:]',
    '    dt = np.diff(x)',
    '    dt = np.where(np.isfinite(dt), dt, 0.0)',
    '    return float(np.sum(dt[mask]))',
    '',
    'def fn_mean_where(y, cond):',
    '    y, cond = aligned_arrays(y, np.asarray(cond, dtype=bool))',
    '    selected = y[cond.astype(bool)]',
    '    selected = selected[np.isfinite(selected)]',
    '    return float(np.mean(selected)) if len(selected) else np.nan',
    '',
    'def fn_min_where(y, cond):',
    '    y, cond = aligned_arrays(y, np.asarray(cond, dtype=bool))',
    '    selected = y[cond.astype(bool)]',
    '    selected = selected[np.isfinite(selected)]',
    '    return float(np.min(selected)) if len(selected) else np.nan',
    '',
    'def fn_max_where(y, cond):',
    '    y, cond = aligned_arrays(y, np.asarray(cond, dtype=bool))',
    '    selected = y[cond.astype(bool)]',
    '    selected = selected[np.isfinite(selected)]',
    '    return float(np.max(selected)) if len(selected) else np.nan',
    '',
    'def fn_integral_where(y, x, cond):',
    '    y, x, cond = aligned_arrays(y, x, np.asarray(cond, dtype=bool))',
    '    cond = cond.astype(bool)',
    '    if len(y) < 2:',
    '        return 0.0',
    '    mask = cond[:-1] & cond[1:]',
    '    dt = np.diff(x)',
    '    area = 0.5 * (y[:-1] + y[1:]) * dt',
    '    valid = mask & np.isfinite(area)',
    '    return float(np.sum(area[valid]))',
    '',
    'SAFE_FUNCS = {',
    '    "sum": fn_sum, "mean": fn_mean, "std": fn_std, "median": fn_median, "quantile": fn_quantile,',
    '    "min": fn_min, "max": fn_max, "first": fn_first, "last": fn_last,',
    '    "integral": fn_integral, "integrate": fn_integral, "integral_where": fn_integral_where,',
    '    "entropy": fn_entropy, "gradient": fn_gradient, "diff": fn_diff,',
    '    "where": fn_where, "duration_where": fn_duration_where,',
    '    "mean_where": fn_mean_where, "min_where": fn_min_where, "max_where": fn_max_where,',
    '    "sqrt": np.sqrt, "log": np.log, "exp": np.exp, "abs": np.abs',
    '}',
    'CONSTANTS = {"pi": np.pi, "e": np.e}',
    'PARSED_EXPR_CACHE = {}',
    '',
    'class FormulaEvaluator:',
    '    def __init__(self, env):',
    '        self.env = env',
    '',
    '    def eval(self, expr):',
    '        expr_key = expr.replace("^", "**")',
    '        tree = PARSED_EXPR_CACHE.get(expr_key)',
    '        if tree is None:',
    '            tree = ast.parse(expr_key, mode="eval")',
    '            PARSED_EXPR_CACHE[expr_key] = tree',
    '        return self.visit(tree.body)',
    '',
    '    def visit(self, node):',
    '        if isinstance(node, ast.Constant):',
    '            return node.value',
    '        if isinstance(node, ast.Name):',
    '            name = resolve_col(node.id)',
    '            if name in self.env:',
    '                return self.env[name]',
    '            if name in CONSTANTS:',
    '                return CONSTANTS[name]',
    '            raise ValueError("Unknown name in formula: %s" % node.id)',
    '        if isinstance(node, ast.UnaryOp):',
    '            value = self.visit(node.operand)',
    '            if isinstance(node.op, ast.USub): return -value',
    '            if isinstance(node.op, ast.UAdd): return value',
    '            raise ValueError("Unsupported unary operator.")',
    '        if isinstance(node, ast.BinOp):',
    '            left, right = self.visit(node.left), self.visit(node.right)',
    '            if isinstance(node.op, ast.Add): return left + right',
    '            if isinstance(node.op, ast.Sub): return left - right',
    '            if isinstance(node.op, ast.Mult): return left * right',
    '            if isinstance(node.op, ast.Div):',
    '                with np.errstate(divide="ignore", invalid="ignore"):',
    '                    try: return left / right',
    '                    except ZeroDivisionError: return np.nan',
    '            if isinstance(node.op, ast.Pow): return left ** right',
    '            raise ValueError("Unsupported binary operator.")',
    '        if isinstance(node, ast.Call):',
    '            if not isinstance(node.func, ast.Name):',
    '                raise ValueError("Only direct function calls are allowed.")',
    '            fname = node.func.id',
    '            if fname not in SAFE_FUNCS:',
    '                raise ValueError("Unsupported function in formula: %s" % fname)',
    '            args = [self.visit(a) for a in node.args]',
    '            kwargs = {kw.arg: self.visit(kw.value) for kw in node.keywords}',
    '            return SAFE_FUNCS[fname](*args, **kwargs)',
    '        if isinstance(node, ast.Compare):',
    '            left = self.visit(node.left)',
    '            masks = []',
    '            for op, comparator in zip(node.ops, node.comparators):',
    '                right = self.visit(comparator)',
    '                if isinstance(op, ast.Lt): mask = left < right',
    '                elif isinstance(op, ast.LtE): mask = left <= right',
    '                elif isinstance(op, ast.Gt): mask = left > right',
    '                elif isinstance(op, ast.GtE): mask = left >= right',
    '                elif isinstance(op, ast.Eq): mask = left == right',
    '                elif isinstance(op, ast.NotEq): mask = left != right',
    '                else: raise ValueError("Unsupported comparison operator.")',
    '                masks.append(mask)',
    '                left = right',
    '            out = masks[0]',
    '            for mask in masks[1:]:',
    '                out = np.logical_and(out, mask)',
    '            return out',
    '        if isinstance(node, ast.BoolOp):',
    '            vals = [self.visit(v) for v in node.values]',
    '            out = vals[0]',
    '            for val in vals[1:]:',
    '                out = np.logical_and(out, val) if isinstance(node.op, ast.And) else np.logical_or(out, val)',
    '            return out',
    '        raise ValueError("Unsupported formula syntax: %s" % ast.dump(node))',
    '',
    'def env_from_frame(df, computed=None):',
    '    env = {}',
    '    for col in df.columns:',
    '        if pd.api.types.is_numeric_dtype(df[col]):',
    '            env[col] = pd.to_numeric(df[col], errors="coerce").to_numpy(dtype=float)',
    '    env["n"] = len(df)',
    '    if computed:',
    '        env.update(computed)',
    '    return env',
    '',
    'def select_window(group, window_expr):',
    '    if not window_expr:',
    '        return group',
    '    evaluator = FormulaEvaluator(env_from_frame(group))',
    '    mask = evaluator.eval(window_expr)',
    '    if not isinstance(mask, np.ndarray) or mask.dtype != bool:',
    '        raise ValueError("window formula must return a boolean mask, e.g. 4.0 <= voltage_V <= 4.2")',
    '    selected = group.loc[mask].copy()',
    '    return selected if len(selected) else group',
    '',
    'def eval_expression(expr, df, computed):',
    '    if len(df) == 0:',
    '        return np.nan',
    '    evaluator = FormulaEvaluator(env_from_frame(df, computed))',
    '    return evaluator.eval(expr)',
    '',
    'def scalar_or_none(value):',
    '    try:',
    '        return scalarize(value)',
    '    except ValueError:',
    '        return None',
    '',
    'def compute_features(timeseries, window_expr, feature_defs):',
    '    rows = []',
    '    for (cell_id, cycle_id), group in timeseries.sort_values(["cell_id", "cycle_id", "time_s"]).groupby(["cell_id", "cycle_id"]):',
    '        selected = select_window(group, window_expr)',
    '        row = {"cell_id": cell_id, "cycle_id": cycle_id, "feature_window_rows": int(len(selected))}',
    '        computed = {}',
    '        for feature_name, expr in feature_defs:',
    '            value = eval_expression(expr, selected, computed)',
    '            computed[feature_name] = value',
    '            scalar_value = scalar_or_none(value)',
    '            if scalar_value is not None:',
    '                row[feature_name] = scalar_value',
    '        rows.append(row)',
    '    return pd.DataFrame(rows)',
    '',
    'DEFAULT_FEATURE_DEFS = [',
    '    ("voltage_mean", "(1 / n) * sum(voltage_V)"),',
    '    ("voltage_std", "sqrt((1 / (n - 1)) * sum((voltage_V - voltage_mean)^2))"),',
    '    ("voltage_kurtosis", "sum((voltage_V - voltage_mean)^4) / ((n - 1) * voltage_std^4)"),',
    '    ("voltage_skewness", "sum((voltage_V - voltage_mean)^3) / ((n - 1) * voltage_std^3)"),',
    '    ("charge_time_s", "last(time_s) - first(time_s)"),',
    '    ("accumulated_charge_Ah", "integral(current_A, time_s) / 3600"),',
    '    ("voltage_slope", "(last(voltage_V) - first(voltage_V)) / (last(time_s) - first(time_s))"),',
    '    ("voltage_entropy", "entropy(voltage_V, bins=20)"),',
    '    ("current_mean", "(1 / n) * sum(current_A)"),',
    '    ("current_std", "sqrt((1 / (n - 1)) * sum((current_A - current_mean)^2))"),',
    '    ("temperature_mean", "(1 / n) * sum(temperature_C)"),',
    '    ("temperature_max", "max(temperature_C)"),',
    ']',
    'DEFAULT_FEATURE_NAMES = [name for name, _ in DEFAULT_FEATURE_DEFS]',
    '',
    'def normalize_expr(expr):',
    '    return " ".join(str(expr).strip().split())',
    '',
    'def is_default_schema(feature_defs):',
    '    return [(name, normalize_expr(expr)) for name, expr in feature_defs] == [(name, normalize_expr(expr)) for name, expr in DEFAULT_FEATURE_DEFS]',
    '',
    'def select_window_frame(data, window_expr):',
    '    if not window_expr:',
    '        return data.copy()',
    '    mask = FormulaEvaluator(env_from_frame(data)).eval(window_expr)',
    '    if not isinstance(mask, np.ndarray) or mask.dtype != bool:',
    '        raise ValueError("window formula must return a boolean mask, e.g. 4.0 <= voltage_V <= 4.2")',
    '    selected = data.loc[mask].copy()',
    '    key_cols = ["cell_id", "cycle_id"]',
    '    all_keys = data[key_cols].drop_duplicates()',
    '    selected_keys = selected[key_cols].drop_duplicates() if len(selected) else all_keys.iloc[0:0]',
    '    missing = all_keys.merge(selected_keys.assign(_selected=1), on=key_cols, how="left")',
    '    missing = missing[missing["_selected"].isna()][key_cols]',
    '    if len(missing):',
    '        selected = pd.concat([selected, data.merge(missing, on=key_cols, how="inner")], ignore_index=True)',
    '    return selected',
    '',
    'def compute_default_features_fast(timeseries, window_expr):',
    '    data = timeseries.sort_values(["cell_id", "cycle_id", "time_s"]).copy()',
    '    selected = select_window_frame(data, window_expr)',
    '    key_cols = ["cell_id", "cycle_id"]',
    '    g = selected.groupby(key_cols, sort=False)',
    '    base = g.agg(',
    '        feature_window_rows=("voltage_V", "size"),',
    '        voltage_mean=("voltage_V", "mean"),',
    '        voltage_std=("voltage_V", "std"),',
    '        time_first=("time_s", "first"),',
    '        time_last=("time_s", "last"),',
    '        voltage_first=("voltage_V", "first"),',
    '        voltage_last=("voltage_V", "last"),',
    '        current_mean=("current_A", "mean"),',
    '        current_std=("current_A", "std"),',
    '        temperature_mean=("temperature_C", "mean"),',
    '        temperature_max=("temperature_C", "max"),',
    '    )',
    '    v_mean = g["voltage_V"].transform("mean")',
    '    centered = selected["voltage_V"] - v_mean',
    '    sum3 = (centered ** 3).groupby([selected["cell_id"], selected["cycle_id"]], sort=False).sum()',
    '    sum4 = (centered ** 4).groupby([selected["cell_id"], selected["cycle_id"]], sort=False).sum()',
    '    denom3 = (base["feature_window_rows"] - 1) * (base["voltage_std"] ** 3)',
    '    denom4 = (base["feature_window_rows"] - 1) * (base["voltage_std"] ** 4)',
    '    base["voltage_kurtosis"] = sum4 / denom4.replace(0, np.nan)',
    '    base["voltage_skewness"] = sum3 / denom3.replace(0, np.nan)',
    '    base["charge_time_s"] = base["time_last"] - base["time_first"]',
    '    base["voltage_slope"] = (base["voltage_last"] - base["voltage_first"]) / base["charge_time_s"].replace(0, np.nan)',
    '    work = selected.copy()',
    '    work["_prev_time"] = g["time_s"].shift()',
    '    work["_prev_current"] = g["current_A"].shift()',
    '    area = 0.5 * (work["current_A"] + work["_prev_current"]) * (work["time_s"] - work["_prev_time"])',
    '    base["accumulated_charge_Ah"] = area.fillna(0).groupby([work["cell_id"], work["cycle_id"]], sort=False).sum() / 3600.0',
    '    base["voltage_entropy"] = g["voltage_V"].apply(lambda s: fn_entropy(s.to_numpy(), bins=20))',
    '    base = base.reset_index()',
    '    return base[["cell_id", "cycle_id", "feature_window_rows"] + DEFAULT_FEATURE_NAMES]',
    '',
    'def main():',
    '    parser = argparse.ArgumentParser()',
    '    parser.add_argument("--data-root", default="data")',
    '    parser.add_argument("--schema", default="features/feature_schema.txt")',
    '    parser.add_argument("--out", default="features/features.csv")',
    '    args = parser.parse_args()',
    '    window_expr, feature_defs = read_schema(args.schema)',
    '    feature_frames = []',
    '    fast_default = is_default_schema(feature_defs)',
    '    for ts in iter_timeseries_frames(args.data_root):',
    '        if fast_default:',
    '            feature_frames.append(compute_default_features_fast(ts, window_expr))',
    '        else:',
    '            feature_frames.append(compute_features(ts, window_expr, feature_defs))',
    '    features = pd.concat(feature_frames, ignore_index=True).drop_duplicates(["cell_id", "cycle_id"], keep="last")',
    '    summary = load_cycle_summary(args.data_root)',
    '    if not summary.empty:',
    '        out = summary.merge(features, on=["cell_id", "cycle_id"], how="left")',
    '    else:',
    '        out = features',
    '    out_path = Path(args.out)',
    '    out_path.parent.mkdir(parents=True, exist_ok=True)',
    '    out.to_csv(out_path, index=False)',
    '    output_feature_count = len([c for c in features.columns if c not in ["cell_id", "cycle_id", "feature_window_rows"]])',
    '    print("Wrote %d rows and %d output formula features to %s" % (len(out), output_feature_count, out_path))',
    '',
    'if __name__ == "__main__":',
    '    main()'
  ].join('\n') + '\n';
}
function bwPrepareSplitPy() {
  return [
    'import argparse',
    'import json',
    'import sys',
    'from pathlib import Path',
    '',
    'ROOT = Path(__file__).resolve().parents[1]',
    'sys.path.insert(0, str(ROOT))',
    '',
    'from dataloader.battery_dataset import load_processed_frame, split_by_ratio, target_column, write_split_files',
    '',
    'def load_json(path):',
    '    with open(path, "r", encoding="utf-8") as f:',
    '        return json.load(f)',
    '',
    'def main():',
    '    parser = argparse.ArgumentParser()',
    '    parser.add_argument("--config", default="config.json")',
    '    parser.add_argument("--split", default="split.json")',
    '    parser.add_argument("--data-root", default="data")',
    '    parser.add_argument("--out", default="splits")',
    '    args = parser.parse_args()',
    '    config = load_json(args.config)',
    '    split = load_json(args.split)',
    '    frame = load_processed_frame(ROOT / args.data_root)',
    '    target = target_column(config)',
    '    if target not in frame.columns:',
    '        raise ValueError("Processed data is missing target column %s for task %s." % (target, config.get("task", {}).get("key", "")))',
    '    frame = frame.dropna(subset=["cell_id", "cycle_id", target]).copy()',
    '    if frame.empty:',
    '        raise ValueError("No usable rows after filtering empty target column %s. Provide already-processed data with labels for the selected task." % target)',
    '    parts, resolved = split_by_ratio(frame, split)',
    '    write_split_files(parts, ROOT / args.out)',
    '    resolved["target_column"] = target',
    '    resolved["source_rows"] = int(len(frame))',
    '    (ROOT / args.out / "resolved_split.json").write_text(json.dumps(resolved, indent=2), encoding="utf-8")',
    '    print("Wrote split files to %s" % (ROOT / args.out))',
    '    print(json.dumps(resolved["rows"], indent=2))',
    '',
    'if __name__ == "__main__":',
    '    main()'
  ].join('\n') + '\n';
}
function bwTrainPy() {
  return `import argparse
import json
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "models"))

from dataloader.battery_dataset import build_sequence_arrays, feature_columns, make_torch_loader, target_column
from models.benchmark_models import build_model

TORCH_MODELS = {"lstm", "cnn", "mlp", "pinn", "transformer"}

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def model_key(name):
    return str(name).lower().replace("-", " ").replace("_", " ").strip()

def model_slug(name):
    return model_key(name).replace(" ", "_")

def is_torch_model(name):
    key = model_key(name)
    return any(item in key for item in TORCH_MODELS)

def torch_model_class(name):
    key = model_key(name)
    if "lstm" in key:
        from lstm import LSTMModel
        return LSTMModel
    if "cnn" in key:
        from cnn import CNNModel
        return CNNModel
    if "transformer" in key:
        from transformer import TransformerModel
        return TransformerModel
    if "pinn" in key:
        from pinn import PINNModel
        return PINNModel
    if "mlp" in key:
        from mlp import MLPModel
        return MLPModel
    raise ValueError("Unsupported PyTorch model: %s" % name)

def metric_dict(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    nonzero = np.abs(y_true) > 1e-8
    mape = float(np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero]))) if np.any(nonzero) else None
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": mape,
        "r2": float(r2_score(y_true, y_pred)) if len(np.unique(y_true)) > 1 else None
    }

def torch_config(model_name, input_dim, config):
    train_params = dict(config.get("train_params", {}))
    train_params.setdefault("learning_rate", 0.001)
    train_params.setdefault("max_epochs", 80)
    train_params.setdefault("patience", 10)
    model_params = {"input_dim": int(input_dim)}
    key = model_key(model_name)
    if "transformer" in key:
        model_params.update({"d_model": 64, "nhead": 4, "num_layers": 2})
    elif "lstm" in key:
        model_params.update({"hidden_dim": 64, "num_layers": 1})
    else:
        model_params.update({"hidden_dim": 64})
    return {"model_params": model_params, "train_params": train_params}

def scale_for_torch(train, val, test, cols):
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    train_out, val_out, test_out = train.copy(), val.copy(), test.copy()
    train_values = scaler.fit_transform(imputer.fit_transform(train[cols]))
    val_values = scaler.transform(imputer.transform(val[cols]))
    test_values = scaler.transform(imputer.transform(test[cols]))
    train_out[cols] = pd.DataFrame(train_values, columns=cols, index=train_out.index)
    val_out[cols] = pd.DataFrame(val_values, columns=cols, index=val_out.index)
    test_out[cols] = pd.DataFrame(test_values, columns=cols, index=test_out.index)
    return train_out, val_out, test_out

def append_predictions(pred_frames, rows, model_name, split_name, y_true, y_pred, meta, adapter):
    metrics = metric_dict(y_true, y_pred)
    metrics.update({"model": model_name, "split": split_name, "adapter": adapter})
    rows.append(metrics)
    pred_frames.append(pd.DataFrame({
        "model": model_name,
        "split": split_name,
        "cell_id": meta["cell_id"].values,
        "cycle_id": meta["cycle_id"].values,
        "y_true": y_true,
        "y_pred": y_pred
    }))

def run_sklearn_model(model_name, train, val, test, target, cols, rows, pred_frames, log_lines, out):
    model, adapter = build_model(model_name)
    pipe = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", model)])
    pipe.fit(train[cols], train[target])
    joblib.dump(pipe, out / ("%s.joblib" % model_slug(model_name)))
    for split_name, part in [("val", val), ("test", test)]:
        pred = pipe.predict(part[cols])
        meta = part[["cell_id", "cycle_id"]].reset_index(drop=True)
        append_predictions(pred_frames, rows, model_name, split_name, part[target].values, pred, meta, adapter)
    log_lines.append("trained model=%s adapter=%s target=%s features=%d train_rows=%d" % (model_name, adapter or "sklearn", target, len(cols), len(train)))

def run_torch_model(model_name, train, val, test, target, cols, config, rows, pred_frames, log_lines, out):
    try:
        seq_len = int(config.get("sequence_length", config.get("torch_sequence_length", 8)))
        batch_size = int(config.get("batch_size", config.get("torch_batch_size", 32)))
        train_s, val_s, test_s = scale_for_torch(train, val, test, cols)
        train_loader = make_torch_loader(train_s, target, cols, seq_len, batch_size, shuffle=True)
        val_loader = make_torch_loader(val_s, target, cols, seq_len, batch_size, shuffle=False)
        cls = torch_model_class(model_name)
        cfg = torch_config(model_name, len(cols), config)
        model = cls(cfg)
        model.fit(train_loader, val_loader, cfg)
        model.save(str(out / ("%s.pt" % model_slug(model_name))))
        for split_name, part in [("val", val_s), ("test", test_s)]:
            x, y, meta = build_sequence_arrays(part, target, cols, seq_len)
            pred = np.asarray(model.predict(x), dtype=float).reshape(-1)
            append_predictions(pred_frames, rows, model_name, split_name, y, pred, meta, "pytorch_sequence")
        log_lines.append("trained model=%s adapter=pytorch_sequence target=%s features=%d sequence_length=%d train_rows=%d" % (model_name, target, len(cols), seq_len, len(train)))
    except ModuleNotFoundError as err:
        if "torch" in str(err).lower():
            raise ModuleNotFoundError("PyTorch model selected but torch is not installed. Run: pip install -r requirements.txt") from err
        raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--splits", default="splits")
    args = parser.parse_args()
    config = load_json(args.config)
    out = ROOT / "outputs"
    out.mkdir(exist_ok=True)
    split_root = ROOT / args.splits
    paths = {name: split_root / ("%s.csv" % name) for name in ["train", "val", "test"]}
    missing = [str(p) for p in paths.values() if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing split files. Run scripts/prepare_split.py first. Missing: %s" % ", ".join(missing))
    train = pd.read_csv(paths["train"])
    val = pd.read_csv(paths["val"])
    test = pd.read_csv(paths["test"])
    target = target_column(config)
    for name, part in [("train", train), ("val", val), ("test", test)]:
        if target not in part.columns:
            raise ValueError("%s split is missing target column %s." % (name, target))
    cols = feature_columns(train, target)
    if not cols:
        raise ValueError("No numeric feature columns found in split data.")
    models = config.get("models") or ["Linear Regression"]
    rows, pred_frames, log_lines = [], [], []
    for model_name in models:
        if is_torch_model(model_name):
            run_torch_model(model_name, train, val, test, target, cols, config, rows, pred_frames, log_lines, out)
        else:
            run_sklearn_model(model_name, train, val, test, target, cols, rows, pred_frames, log_lines, out)
    metrics_df = pd.DataFrame(rows)
    preds = pd.concat(pred_frames, ignore_index=True)
    per_cell = preds.groupby(["model", "split", "cell_id"])[["y_true", "y_pred"]].apply(lambda g: pd.Series(metric_dict(g["y_true"], g["y_pred"]))).reset_index()
    metrics = {
        "dataset": config.get("dataset", {}),
        "task": config.get("task", {}),
        "target_column": target,
        "features": cols,
        "split_files": {k: str(v) for k, v in paths.items()},
        "metrics": metrics_df.to_dict(orient="records")
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    preds.to_csv(out / "predictions.csv", index=False)
    per_cell.to_csv(out / "per_cell_metrics.csv", index=False)
    (out / "training_log.csv").write_text("\\n".join(log_lines) + "\\n", encoding="utf-8")
    print(metrics_df.to_string(index=False))
    print("Wrote outputs to %s" % out)

if __name__ == "__main__":
    main()
`;
}
function bwExportResultsPy() {
  return [
    'import argparse',
    'import json',
    'from pathlib import Path',
    'import pandas as pd',
    '',
    'def main():',
    '    parser = argparse.ArgumentParser()',
    '    parser.add_argument("--outputs", default="outputs")',
    '    args = parser.parse_args()',
    '    root = Path(args.outputs)',
    '    metrics_path = root / "metrics.json"',
    '    if not metrics_path.exists():',
    '        raise FileNotFoundError("Run scripts/train.py before exporting results.")',
    '    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))',
    '    lines = ["# Benchmark Results", ""]',
    '    lines.append("Dataset: `%s`" % metrics.get("dataset", {}).get("id", ""))',
    '    lines.append("Task: `%s`" % metrics.get("task", {}).get("name", ""))',
    '    lines.append("")',
    '    table = pd.DataFrame(metrics.get("metrics", []))',
    '    if not table.empty:',
    '        lines.append(table.to_markdown(index=False))',
    '    if metrics.get("warnings"):',
    '        lines.append("")',
    '        lines.append("## Warnings")',
    '        for item in metrics["warnings"]:',
    '            lines.append("- " + item)',
    '    (root / "summary.md").write_text("\\n".join(lines) + "\\n", encoding="utf-8")',
    '    print("Wrote %s" % (root / "summary.md"))',
    '',
    'if __name__ == "__main__":',
    '    main()'
  ].join('\n') + '\n';
}
function bwRunBenchmarkSh() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'if ! find data -name "*timeseries*.csv" -print -quit | grep -q .; then',
    '  echo "No *_timeseries*.csv files found under data/."',
    '  echo "Copy the whole processed dataset folder into data/ before running."',
    '  exit 1',
    'fi',
    'if ! find data -name "*cycle_summary*.csv" -print -quit | grep -q .; then',
    '  echo "No *_cycle_summary*.csv files found under data/."',
    '  echo "The dataset folder under data/ must contain a *_cycle_summary*.csv file for SOH/RUL labels."',
    '  exit 1',
    'fi',
    '',
    'python scripts/compute_features.py --data-root data --schema features/feature_schema.txt --out features/features.csv',
    'python scripts/prepare_split.py --config config.json --split split.json --data-root features --out splits',
    'python scripts/train.py --config config.json --splits splits',
    'python scripts/export_results.py --outputs outputs'
  ].join('\n') + '\n';
}
function bwUsesTorch(manifest) {
  const torchNames = ['lstm', 'cnn', 'mlp', 'pinn', 'transformer'];
  return (manifest.models || []).some(name => {
    const key = String(name || '').toLowerCase();
    return torchNames.some(t => key.includes(t));
  });
}
function bwRequirementsTxt(manifest) {
  const req = ['numpy>=1.23', 'pandas>=1.5', 'scikit-learn>=1.2', 'joblib>=1.2', 'tabulate>=0.9'];
  if (bwUsesTorch(manifest)) req.push('torch>=2.0');
  return req.join('\n') + '\n';
}
function bwModelNameKey(name) {
  return String(name || '').toLowerCase().replace(/[-_]/g, ' ').trim();
}
function bwSelectedTorchModelFiles(root, manifest) {
  const models = manifest.models || [];
  const has = token => models.some(name => bwModelNameKey(name).includes(token));
  const files = [];
  if (!bwUsesTorch(manifest)) return files;
  files.push({ name: root + '/models/dataset_interface.py', data: bwDatasetInterfacePy() });
  if (has('cnn')) files.push({ name: root + '/models/cnn.py', data: bwCnnPy() });
  if (has('lstm')) files.push({ name: root + '/models/lstm.py', data: bwLstmPy() });
  if (has('mlp')) files.push({ name: root + '/models/mlp.py', data: bwMlpPy() });
  if (has('pinn')) files.push({ name: root + '/models/pinn.py', data: bwPinnPy() });
  if (has('transformer')) files.push({ name: root + '/models/transformer.py', data: bwTransformerPy() });
  return files;
}
function bwBuildPackageFiles(root, manifest) {
  const files = [
    { name: root + '/README.md', data: bwReadmeMd(manifest) },
    { name: root + '/config.json', data: JSON.stringify(manifest, null, 2) + '\n' },
    { name: root + '/split.json', data: JSON.stringify(manifest.split, null, 2) + '\n' },
    { name: root + '/requirements.txt', data: bwRequirementsTxt(manifest) },
    { name: root + '/run_benchmark.sh', data: bwRunBenchmarkSh() },
    { name: root + '/data/', data: '' },
    { name: root + '/dataloader/battery_dataset.py', data: bwDataloaderPy() },
    { name: root + '/models/benchmark_models.py', data: bwModelsPy() },
    { name: root + '/features/feature_schema.txt', data: bwFeatureSchemaText() },
    { name: root + '/scripts/compute_features.py', data: bwComputeFeaturesPy() },
    { name: root + '/scripts/prepare_split.py', data: bwPrepareSplitPy() },
    { name: root + '/scripts/train.py', data: bwTrainPy() },
    { name: root + '/scripts/export_results.py', data: bwExportResultsPy() }
  ];
  return files.concat(bwSelectedTorchModelFiles(root, manifest));
}
function bwCrc32(bytes) {
  if (!bwCrc32.table) {
    bwCrc32.table = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = bwCrc32.table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function bwU16(arr, off, value) {
  arr[off] = value & 0xff;
  arr[off + 1] = (value >>> 8) & 0xff;
}
function bwU32(arr, off, value) {
  arr[off] = value & 0xff;
  arr[off + 1] = (value >>> 8) & 0xff;
  arr[off + 2] = (value >>> 16) & 0xff;
  arr[off + 3] = (value >>> 24) & 0xff;
}
function bwDosTimeDate(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = Math.max(1, date.getDate());
  const month = date.getMonth() + 1;
  const year = Math.max(0, date.getFullYear() - 1980);
  return { time: time, date: (year << 9) | (month << 5) | day };
}
function bwConcatBytes(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(p => { out.set(p, offset); offset += p.length; });
  return out;
}
function bwZipBlob(files) {
  const enc = new TextEncoder();
  const now = bwDosTimeDate(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach(file => {
    const nameBytes = enc.encode(file.name);
    const dataBytes = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
    const crc = bwCrc32(dataBytes);
    const local = new Uint8Array(30 + nameBytes.length);
    bwU32(local, 0, 0x04034b50);
    bwU16(local, 4, 20);
    bwU16(local, 6, 0x0800);
    bwU16(local, 8, 0);
    bwU16(local, 10, now.time);
    bwU16(local, 12, now.date);
    bwU32(local, 14, crc);
    bwU32(local, 18, dataBytes.length);
    bwU32(local, 22, dataBytes.length);
    bwU16(local, 26, nameBytes.length);
    bwU16(local, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, dataBytes);

    const central = new Uint8Array(46 + nameBytes.length);
    bwU32(central, 0, 0x02014b50);
    bwU16(central, 4, 20);
    bwU16(central, 6, 20);
    bwU16(central, 8, 0x0800);
    bwU16(central, 10, 0);
    bwU16(central, 12, now.time);
    bwU16(central, 14, now.date);
    bwU32(central, 16, crc);
    bwU32(central, 20, dataBytes.length);
    bwU32(central, 24, dataBytes.length);
    bwU16(central, 28, nameBytes.length);
    bwU16(central, 30, 0);
    bwU16(central, 32, 0);
    bwU16(central, 34, 0);
    bwU16(central, 36, 0);
    bwU32(central, 38, 0);
    bwU32(central, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + dataBytes.length;
  });
  const centralStart = offset;
  const central = bwConcatBytes(centralParts);
  const end = new Uint8Array(22);
  bwU32(end, 0, 0x06054b50);
  bwU16(end, 4, 0);
  bwU16(end, 6, 0);
  bwU16(end, 8, files.length);
  bwU16(end, 10, files.length);
  bwU32(end, 12, central.length);
  bwU32(end, 16, centralStart);
  bwU16(end, 20, 0);
  return new Blob([bwConcatBytes(localParts), central, end], { type: 'application/zip' });
}
async function bwDownloadPackage() {
  const sel = BW.selId ? DATASETS.find(d => d.id === BW.selId) : null;
  const models = typeof bwSelectedModels === 'function' ? bwSelectedModels() : [];
  const ok = sel && bwCellNum(sel) > 0 && BW.split.train.length > 0 && BW.split.val.length > 0 && BW.split.test.length > 0
    && (models && models.length > 0);
  if (!ok) {
    if (typeof showToast === 'function') showToast('Complete dataset, cell split and model before exporting the training package', 'error');
    return false;
  }
  const manifest = bwBuildManifest(sel);
  const info = bwPackageInfo(sel);
  const root = info.root;
  const files = bwBuildPackageFiles(root, manifest);
  const blob = bwZipBlob(files);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = info.zip;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    bwPackageExported = true;
    bwUpdateProgress();
    if (typeof showToast === 'function') showToast('Download started. If no zip appears, open this page in Chrome or Safari and try again.', 'success', 6500);
    return true;
  } catch (err) {
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('This embedded browser blocked the zip download. Open the localhost page in Chrome or Safari.', 'error', 7000);
    return false;
  }
}
async function bwCopyTerminalCommand() {
  const cmd = (document.getElementById('bw-terminal-command') || {}).textContent || '';
  const text = cmd.trim();
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
    if (typeof showToast === 'function') showToast('Terminal command copied.', 'success');
  } catch (_) {
    if (typeof showToast === 'function') showToast('Copy failed. Select the command block manually.', 'error');
  }
}
window.bwDownloadPackage = bwDownloadPackage;
window.bwCopyTerminalCommand = bwCopyTerminalCommand;
function bwRunBenchmark() {
  const sel = BW.selId ? DATASETS.find(d => d.id === BW.selId) : null;
  const ok = sel && bwCellNum(sel) > 0 && BW.split.train.length > 0 && BW.split.val.length > 0 && BW.split.test.length > 0
    && document.querySelectorAll('.bw-model-item.selected').length > 0;
  if (!ok) { if (typeof showToast === 'function') showToast('Finish Dataset, Cell Split and Model first', 'error'); return; }
  bwPackageExported = true;
  bwHasRun = true;
  bwUpdateProgress();
  if (typeof showToast === 'function') showToast('Benchmark complete — all steps done', 'success');
  const res = document.querySelector('.bw-results');
  if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bwApplyFilters() {
  const v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  BW.f.chem = v('bw-f-chem'); BW.f.form = v('bw-f-form'); BW.f.inst = v('bw-f-inst'); BW.f.temp = v('bw-f-temp');
  BW.page = 1; bwRenderDatasets();
}
function bwClearFilters() {
  ['bw-f-chem','bw-f-form','bw-f-inst','bw-f-temp'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const s = document.getElementById('bw-ds-search'); if (s) s.value = '';
  BW.f = { chem:'', form:'', inst:'', temp:'', q:'' }; BW.page = 1; bwRenderDatasets();
}
function bwSearchDatasets(val) { BW.f.q = (val || '').trim().toLowerCase(); BW.page = 1; bwRenderDatasets(); }

function bwRefresh() { if (!document.getElementById('bw-ds-tbody')) return; bwPopulateFilters(); bwRenderDatasets(); }
bwRefresh();

var BWR = {
  current: 1,
  completed: new Set(),
  task: '',
  datasetId: null,
  signals: new Set(),
  split: { train: 60, val: 20, test: 20 },
  splitProtocol: 'Manual',
  splitError: false,
  models: new Set(),
  downloaded: false,
  uploaded: false,
  filters: { q: '', all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() },
  pendingFilters: { all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() },
  datasetPage: 1,
  datasetPageSize: 4,
  dragHandle: null
};
var BWR_STEP_LABELS = [
  '',
  'Select Task',
  'Select Data',
  'Split Data',
  'Select Models',
  'Local Run',
  'View Results'
];

function bwFlowInit() {
  if (!document.getElementById('bw-flow')) return;
  document.querySelectorAll('#page-benchmarks > .bw-grid .bw-model-item.selected').forEach(el => el.classList.remove('selected'));
  BW.selId = null;
  const randomCtrl = document.getElementById('bwr-random-ctrl');
  if (randomCtrl) randomCtrl.hidden = BWR.splitProtocol !== 'Random';
  bwSyncDatasetFilterPopup();
  bwFlowRenderDatasets();
  bwApplySplit(BWR.split.train, BWR.split.val, BWR.split.test);
  bwRenderMockTrajectory();
  bwUpdateProgress();
}

function bwCloneFilterState(src) {
  return {
    all: !!src.all,
    chem: cloneSet(src.chem || new Set()),
    form: cloneSet(src.form || new Set()),
    cat: cloneSet(src.cat || new Set()),
    domain: cloneSet(src.domain || new Set()),
    duty: cloneSet(src.duty || new Set())
  };
}
function bwDatasetYear(d) {
  return extractYearFromRef(d.ref_name) || extractYearFromRef(d.name) || 0;
}
function bwFlowSortedDatasets(list) {
  return list.slice().sort((a, b) => (bwDatasetYear(b) - bwDatasetYear(a)) || String(a.ref_name || a.name).localeCompare(String(b.ref_name || b.name)));
}
function bwDatasetMatchesSet(set, getter) {
  if (!set || set.size === 0) return true;
  return getter(set);
}
function bwFlowFilteredDatasets() {
  const q = BWR.filters.q;
  const f = BWR.filters;
  return bwFlowSortedDatasets(DATASETS.filter(d => {
    if (q) {
      const hay = [d.name, d.ref_name, d.notes, d.chemistry, d.form].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.all) return true;
    if (!bwDatasetMatchesSet(f.chem, set => set.has(d.chemistry))) return false;
    if (!bwDatasetMatchesSet(f.form, set => set.has(d.form))) return false;
    if (!bwDatasetMatchesSet(f.cat, set => set.has(d.category))) return false;
    if (!bwDatasetMatchesSet(f.domain, set => inferDatasetDomains(d).some(v => set.has(v)))) return false;
    if (!bwDatasetMatchesSet(f.duty, set => inferDatasetProfiles(d).some(v => set.has(v)))) return false;
    return true;
  }));
}
function bwHasDatasetFilters(state) {
  return !!(state.all || state.chem.size || state.form.size || state.cat.size || state.domain.size || state.duty.size);
}
function bwFilterLabel(type, value) {
  if (type === 'cat') return getSectionCatLabel(value);
  if (type === 'domain') return String(value).toUpperCase() === 'EV' ? 'EV' : String(value).charAt(0).toUpperCase() + String(value).slice(1);
  if (type === 'duty') return ({ cccv: 'CC/CV', dynamic: 'Dynamic', multi: 'Multi-rate' }[value] || value);
  return value;
}
function bwRenderAppliedDatasetFilters() {
  const box = document.getElementById('bwr-applied-filter-chips');
  if (!box) return;
  const chips = [];
  if (BWR.filters.all) chips.push({ type: 'all', tokenType: 'all', value: 'all', label: 'All datasets' });
  [['chem','chemistry'], ['form','form'], ['cat','category'], ['domain','domain'], ['duty','profile']].forEach(([type, tokenType]) => {
    BWR.filters[type].forEach(value => chips.push({ type, tokenType, value, label: bwFilterLabel(type, value) }));
  });
  box.classList.toggle('has-chips', chips.length > 0);
  box.innerHTML = chips.map(chip => `<span class="applied-chip ${filterTypeClass(chip.tokenType)}">${esc(chip.label)}<button aria-label="Remove ${escAttr(chip.label)} filter" onclick="bwRemoveAppliedDatasetFilter('${chip.type}','${escAttr(chip.value)}')">×</button></span>`).join('');
}
function bwSyncDatasetFilterPopup() {
  document.querySelectorAll('[data-bwr-chem]').forEach(t => t.classList.toggle('active', BWR.pendingFilters.chem.has(t.dataset.bwrChem)));
  document.querySelectorAll('[data-bwr-form]').forEach(t => t.classList.toggle('active', BWR.pendingFilters.form.has(t.dataset.bwrForm)));
  document.querySelectorAll('[data-bwr-cat]').forEach(t => t.classList.toggle('active', BWR.pendingFilters.cat.has(t.dataset.bwrCat)));
  document.querySelectorAll('[data-bwr-domain]').forEach(t => t.classList.toggle('active', BWR.pendingFilters.domain.has(t.dataset.bwrDomain)));
  document.querySelectorAll('[data-bwr-duty]').forEach(t => t.classList.toggle('active', BWR.pendingFilters.duty.has(t.dataset.bwrDuty)));
  const all = document.querySelector('[data-bwr-all]');
  if (all) all.classList.toggle('active', BWR.pendingFilters.all);
}
function bwFlowDatasetCardHTML(d) {
  const html = datasetCardHTML(d)
    .replace('class="dataset-card"', 'class="dataset-card bwr-dataset-card' + (BWR.datasetId === d.id ? ' bwr-selected' : '') + '"')
    .replace(/onclick="openDatasetModal\('[^']+'\)"/, `onclick="bwSelectDataset('${escAttr(d.id)}')"`);
  return html;
}
function bwRenderDatasetPager(total, pages) {
  const info = document.getElementById('bwr-pager-info');
  const box = document.getElementById('bwr-pager-btns');
  if (info) {
    const start = total ? (BWR.datasetPage - 1) * BWR.datasetPageSize + 1 : 0;
    const end = Math.min(total, BWR.datasetPage * BWR.datasetPageSize);
    info.textContent = total ? start + '-' + end + ' of ' + total + ' datasets' : '0 datasets';
  }
  if (!box) return;
  const pageItems = bwDatasetPagerItems(BWR.datasetPage, pages);
  box.innerHTML = '<button class="bw-pg bw-pg-nav" ' + (BWR.datasetPage > 1 ? 'onclick="bwGoDatasetPage(' + (BWR.datasetPage - 1) + ')"' : 'disabled') + '>‹</button>'
    + pageItems.map(item => item === 'dots'
      ? '<span class="bw-pg-dots" aria-hidden="true">…</span>'
      : '<button class="bw-pg ' + (item === BWR.datasetPage ? 'active' : '') + '" onclick="bwGoDatasetPage(' + item + ')"' + (item === BWR.datasetPage ? ' aria-current="page"' : '') + '>' + item + '</button>'
    ).join('')
    + '<button class="bw-pg bw-pg-nav" ' + (BWR.datasetPage < pages ? 'onclick="bwGoDatasetPage(' + (BWR.datasetPage + 1) + ')"' : 'disabled') + '>›</button>';
}

function bwDatasetPagerItems(current, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const pagesToShow = new Set([1, pages, current]);
  if (current <= 3) {
    [2, 3].forEach(p => pagesToShow.add(p));
  } else if (current >= pages - 2) {
    [pages - 2, pages - 1].forEach(p => pagesToShow.add(p));
  } else {
    [current - 1, current + 1].forEach(p => pagesToShow.add(p));
  }
  const items = [];
  let last = 0;
  Array.from(pagesToShow).filter(p => p >= 1 && p <= pages).sort((a, b) => a - b).forEach(p => {
    if (last && p - last > 1) items.push('dots');
    items.push(p);
    last = p;
  });
  return items;
}

function bwFlowRenderDatasets() {
  const box = document.getElementById('bwr-dataset-list');
  if (!box) return;
  const list = bwFlowFilteredDatasets();
  const pages = Math.max(1, Math.ceil(list.length / BWR.datasetPageSize));
  if (BWR.datasetPage > pages) BWR.datasetPage = pages;
  const start = (BWR.datasetPage - 1) * BWR.datasetPageSize;
  const slice = list.slice(start, start + BWR.datasetPageSize);
  box.innerHTML = slice.length ? '<div class="dataset-card-grid">' + slice.map(bwFlowDatasetCardHTML).join('') + '</div>' : '<div class="bw-flow-empty">No datasets match these filters.</div>';
  bwRenderDatasetPager(list.length, pages);
  bwRenderAppliedDatasetFilters();
  const searchBox = document.getElementById('bwr-search-box');
  if (searchBox) searchBox.classList.toggle('has-text', !!BWR.filters.q);
}

window.bwSearchDatasets = function(val) {
  BWR.filters.q = (val || '').trim().toLowerCase();
  BWR.datasetPage = 1;
  bwFlowRenderDatasets();
};
window.bwClearSearch = function() {
  const input = document.getElementById('bwr-ds-search');
  if (input) input.value = '';
  BWR.filters.q = '';
  BWR.datasetPage = 1;
  bwFlowRenderDatasets();
};
window.bwClearFilters = function() {
  BWR.filters = { q: '', all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() };
  BWR.pendingFilters = bwCloneFilterState(BWR.filters);
  const input = document.getElementById('bwr-ds-search');
  if (input) input.value = '';
  BWR.datasetPage = 1;
  bwSyncDatasetFilterPopup();
  bwFlowRenderDatasets();
};
window.bwToggleDatasetFilters = function() {
  const pop = document.getElementById('bwr-dataset-filter-popover');
  const btn = document.querySelector('#page-benchmarks .bwr-dataset-search-panel .dataset-filter-toggle');
  if (!pop) return;
  if (pop.classList.contains('open')) return;
  BWR.pendingFilters = bwCloneFilterState(BWR.filters);
  bwSyncDatasetFilterPopup();
  pop.classList.add('open');
  if (btn) btn.setAttribute('aria-expanded', 'true');
};
function bwCloseDatasetFilters() {
  const pop = document.getElementById('bwr-dataset-filter-popover');
  const btn = document.querySelector('#page-benchmarks .bwr-dataset-search-panel .dataset-filter-toggle');
  if (pop) pop.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => {
  const pop = document.getElementById('bwr-dataset-filter-popover');
  if (!pop || !pop.classList.contains('open')) return;
  if (e.target.closest('#bwr-dataset-filter-popover') || e.target.closest('#page-benchmarks .bwr-dataset-search-panel .dataset-filter-toggle')) return;
  bwCloseDatasetFilters();
});
window.bwToggleAllDatasetsFilter = function(el) {
  BWR.pendingFilters.all = !BWR.pendingFilters.all;
  if (BWR.pendingFilters.all) ['chem','form','cat','domain','duty'].forEach(k => BWR.pendingFilters[k].clear());
  bwSyncDatasetFilterPopup();
};
window.bwToggleDatasetFilterTag = function(el, type) {
  const map = { chem: 'bwrChem', form: 'bwrForm', cat: 'bwrCat', domain: 'bwrDomain', duty: 'bwrDuty' };
  const value = el.dataset[map[type]];
  if (!value) return;
  BWR.pendingFilters.all = false;
  const set = BWR.pendingFilters[type];
  if (set.has(value)) set.delete(value); else set.add(value);
  bwSyncDatasetFilterPopup();
};
window.bwClearPendingDatasetFilters = function() {
  BWR.pendingFilters = { all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() };
  bwSyncDatasetFilterPopup();
};
window.bwApplyDatasetFilters = function() {
  BWR.filters = Object.assign(bwCloneFilterState(BWR.pendingFilters), { q: BWR.filters.q });
  BWR.datasetPage = 1;
  bwCloseDatasetFilters();
  bwFlowRenderDatasets();
};
window.bwRemoveAppliedDatasetFilter = function(type, value) {
  if (type === 'all') BWR.filters.all = false;
  else if (BWR.filters[type]) BWR.filters[type].delete(value);
  BWR.pendingFilters = bwCloneFilterState(BWR.filters);
  BWR.datasetPage = 1;
  bwSyncDatasetFilterPopup();
  bwFlowRenderDatasets();
};
window.bwGoDatasetPage = function(page) {
  const pages = Math.max(1, Math.ceil(bwFlowFilteredDatasets().length / BWR.datasetPageSize));
  BWR.datasetPage = Math.min(pages, Math.max(1, page));
  bwFlowRenderDatasets();
};
window.bwSelectDataset = function(id) {
  BWR.datasetId = id;
  BW.selId = id;
  bwFlowRenderDatasets();
  bwSyncSplitCells();
  bwUpdatePackagePreview();
  bwUpdateProgress();
};
window.bwSelectTask = function(task) {
  BWR.task = task;
  document.querySelectorAll('[data-bwr-task]').forEach(card => card.classList.toggle('selected', card.dataset.bwrTask === task));
  const sync = document.getElementById('bw-sum-task');
  if (sync) sync.textContent = task;
  bwUpdatePackagePreview();
  bwUpdateProgress();
};
window.bwToggleFeat = function(el) {
  const name = el.dataset.name || el.textContent.trim();
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) BWR.signals.add(name); else BWR.signals.delete(name);
  bwUpdateProgress();
};
window.bwToggleModel = function(el) {
  const nameEl = el.querySelector('.bw-model-name');
  const name = nameEl ? nameEl.textContent.trim() : el.textContent.trim();
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) BWR.models.add(name); else BWR.models.delete(name);
  bwUpdatePackagePreview();
  bwUpdateProgress();
};
window.bwPickSplitProtocol = function(el, name) {
  document.querySelectorAll('#page-benchmarks .bw-flow .bwr-split-protocol-card').forEach(card => {
    card.classList.toggle('selected', card === el);
  });
  BWR.splitProtocol = name;
  BW.splitMode = name === 'Random' ? 'random' : 'manual';
  const randomCtrl = document.getElementById('bwr-random-ctrl');
  if (randomCtrl) randomCtrl.hidden = BW.splitMode !== 'random';
  const sync = document.getElementById('bw-sum-split');
  if (sync) sync.textContent = name;
  if (BW.splitMode === 'random') {
    BW.ratio = { ...BWR.split };
    bwShuffleSplit();
  } else {
    bwRenderSplit();
  }
  bwUpdatePackagePreview();
};

function bwSelectedDataset() {
  return BWR.datasetId ? DATASETS.find(d => d.id === BWR.datasetId) : null;
}
function bwFlowDatasetCellCount() {
  const ds = bwSelectedDataset();
  const count = ds ? bwCellNum(ds) : 0;
  // Fallback keeps the split preview meaningful until a dataset is selected or when a catalog row has no cell count.
  return count || 40;
}
function bwSyncSplitCells() {
  const n = bwFlowDatasetCellCount();
  const cells = [];
  for (let i = 1; i <= n; i++) cells.push('B' + String(i).padStart(2, '0'));
  const trainN = Math.max(1, Math.round(n * BWR.split.train / 100));
  const valN = Math.max(1, Math.round(n * BWR.split.val / 100));
  const testN = Math.max(0, n - trainN - valN);
  BW.split = {
    train: cells.slice(0, trainN),
    val: cells.slice(trainN, trainN + valN),
    test: cells.slice(trainN + valN),
    excluded: []
  };
  BW.ratio = { ...BWR.split };
  bwRenderSplit();
}
function bwApplySplit(train, val, test) {
  BWR.split = { train: Math.round(train), val: Math.round(val), test: Math.round(test) };
  BW.ratio = { ...BWR.split };
  BWR.splitError = false;
  const flow = document.getElementById('bw-flow');
  if (flow) {
    flow.style.setProperty('--train-pct', Math.max(5, BWR.split.train) + '%');
    flow.style.setProperty('--val-pct', Math.max(5, BWR.split.val) + '%');
    flow.style.setProperty('--test-pct', Math.max(5, BWR.split.test) + '%');
  }
  const trainEl = document.getElementById('bwr-split-train');
  const valEl = document.getElementById('bwr-split-val');
  const testEl = document.getElementById('bwr-split-test');
  const a = document.getElementById('bwr-handle-a');
  const b = document.getElementById('bwr-handle-b');
  if (trainEl) trainEl.style.width = BWR.split.train + '%';
  if (valEl) valEl.style.width = BWR.split.val + '%';
  if (testEl) testEl.style.width = BWR.split.test + '%';
  if (a) a.style.left = BWR.split.train + '%';
  if (b) b.style.left = (BWR.split.train + BWR.split.val) + '%';
  ['train', 'val', 'test'].forEach(key => {
    const input = document.getElementById('bwr-input-' + key);
    if (input) input.value = BWR.split[key];
  });
  const err = document.getElementById('bwr-split-error');
  if (err) err.textContent = '';
  const activeCount = (BW.split.train || []).length + (BW.split.val || []).length + (BW.split.test || []).length;
  if (activeCount || (BW.split.excluded || []).length) {
    if (BW.splitMode === 'random') bwShuffleSplit(); else bwRenderSplit();
  } else {
    bwSyncSplitCells();
  }
  bwUpdatePackagePreview();
  bwUpdateProgress();
}
window.bwSplitPointerDown = function(event) {
  const handle = event.target.closest('.bw-split-handle');
  if (!handle) return;
  event.preventDefault();
  BWR.dragHandle = handle.dataset.handle;
  handle.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', bwSplitPointerMove);
  window.addEventListener('pointerup', bwSplitPointerUp, { once: true });
};
function bwSplitPointerMove(event) {
  if (!BWR.dragHandle) return;
  const slider = document.getElementById('bwr-split-slider');
  if (!slider) return;
  const rect = slider.getBoundingClientRect();
  const pct = Math.round((event.clientX - rect.left) / Math.max(1, rect.width) * 100);
  const min = 5;
  let train = BWR.split.train;
  let val = BWR.split.val;
  let test = BWR.split.test;
  if (BWR.dragHandle === 'a') {
    const boundary = Math.max(min, Math.min(pct, 100 - min - test));
    train = boundary;
    val = 100 - train - test;
  } else {
    const boundary = Math.max(train + min, Math.min(pct, 100 - min));
    val = boundary - train;
    test = 100 - train - val;
  }
  bwApplySplit(train, val, test);
}
function bwSplitPointerUp() {
  BWR.dragHandle = null;
  window.removeEventListener('pointermove', bwSplitPointerMove);
}
function bwResetSplitInputs() {
  ['train', 'val', 'test'].forEach(key => {
    const input = document.getElementById('bwr-input-' + key);
    if (input) input.value = BWR.split[key];
  });
}
function bwSplitInputError(message) {
  const err = document.getElementById('bwr-split-error');
  if (err) err.textContent = message;
  bwResetSplitInputs();
  BWR.splitError = false;
  bwUpdateProgress();
}
function bwReduceSplitBuckets(next, buckets, amount, min) {
  let remaining = amount;
  buckets.forEach(key => {
    if (remaining <= 0) return;
    const available = Math.max(0, next[key] - min);
    const take = Math.min(available, remaining);
    next[key] -= take;
    remaining -= take;
  });
  return remaining <= 0;
}
function bwGrowSplitBuckets(next, buckets, amount) {
  if (!buckets.length) return;
  next[buckets[0]] += amount;
}
window.bwSplitInputCommit = function(changed) {
  const key = changed || 'train';
  const input = document.getElementById('bwr-input-' + key);
  const value = input ? Number(input.value) : NaN;
  const min = 5;
  const max = 100 - (min * 2);
  if (!['train', 'val', 'test'].includes(key) || !Number.isFinite(value) || value < min || value > max) {
    bwSplitInputError('Enter a percentage between ' + min + ' and ' + max + '.');
    return;
  }
  const next = { train: BWR.split.train, val: BWR.split.val, test: BWR.split.test };
  const rounded = Math.round(value);
  const delta = rounded - next[key];
  if (delta === 0) {
    bwApplySplit(next.train, next.val, next.test);
    return;
  }
  next[key] = rounded;
  const adjacentOrder = {
    train: ['val', 'test'],
    val: ['train', 'test'],
    test: ['val', 'train']
  }[key];
  if (delta > 0) {
    if (!bwReduceSplitBuckets(next, adjacentOrder, delta, min)) {
      bwSplitInputError('That split cannot be applied while keeping every section at least ' + min + '%.');
      return;
    }
  } else {
    bwGrowSplitBuckets(next, adjacentOrder, Math.abs(delta));
  }
  if (next.train < min || next.val < min || next.test < min || next.train + next.val + next.test !== 100) {
    bwSplitInputError('That split cannot be applied. Train, Val, and Test must remain valid and total 100%.');
    return;
  }
  bwApplySplit(next.train, next.val, next.test);
};

function bwStepValid(step) {
  if (step === 1) return !!BWR.task;
  if (step === 2) return !!BWR.datasetId && BWR.signals.size > 0;
  if (step === 3) return !BWR.splitError && BWR.split.train + BWR.split.val + BWR.split.test === 100;
  if (step === 4) return BWR.models.size > 0;
  if (step === 5) return BWR.uploaded;
  return true;
}
function bwSyncPackageState() {
  BW.selId = BWR.datasetId;
  const activeCount = (BW.split.train || []).length + (BW.split.val || []).length + (BW.split.test || []).length;
  if (activeCount) bwRenderSplit(true); else bwSyncSplitCells();
  const taskSync = document.getElementById('bw-sum-task');
  if (taskSync) taskSync.textContent = BWR.task || 'SOH Estimation';
  bwUpdatePackagePreview();
  const summary = document.getElementById('bwr-local-summary');
  const ds = bwSelectedDataset();
  if (summary) {
    const tags = [
      ['Dataset', ds ? ds.name : 'Select dataset'],
      ['Task', BWR.task || 'Select task'],
      ['Models', BWR.models.size ? Array.from(BWR.models).join(', ') : 'Select models'],
      ['Data Split', BWR.split.train + ':' + BWR.split.val + ':' + BWR.split.test]
    ];
    summary.innerHTML = tags.map(([k, v]) => '<span class="bw-summary-tag"><span>' + esc(k) + ':</span><b title="' + escAttr(v) + '">' + esc(v) + '</b></span>').join('');
  }
}
window.bwUpdateProgress = function() {
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  document.querySelectorAll('#page-benchmarks .bw-flow-progress .bw-pstep').forEach(stepEl => {
    const step = Number(stepEl.dataset.bwrStep);
    const num = stepEl.querySelector('.bw-pnum');
    stepEl.classList.toggle('active', step === BWR.current);
    stepEl.classList.toggle('done', BWR.completed.has(step));
    if (num) num.innerHTML = BWR.completed.has(step) ? check : String(step);
  });
  document.querySelectorAll('#page-benchmarks .bw-flow-step').forEach(panel => {
    panel.classList.toggle('is-active', Number(panel.dataset.bwrPanel) === BWR.current);
  });
  const prev = document.getElementById('bw-wizard-prev');
  const next = document.getElementById('bw-wizard-next');
  const status = document.getElementById('bw-wizard-status');
  if (prev) prev.hidden = BWR.current === 1;
  if (next) {
    next.hidden = BWR.current === 6;
    next.disabled = !bwStepValid(BWR.current);
    next.textContent = BWR.current === 5 ? 'View Results' : 'Next';
  }
  if (status) status.textContent = 'Step ' + BWR.current + ' of 6 - ' + BWR_STEP_LABELS[BWR.current];
  if (BWR.current === 5) bwSyncPackageState();
};
window.bwWizardGo = function(step) {
  const maxAllowed = Math.max(BWR.current, (BWR.completed.size ? Math.max(...Array.from(BWR.completed)) + 1 : 1));
  if (step > maxAllowed || step < 1 || step > 6) return;
  BWR.current = step;
  bwUpdateProgress();
};
window.bwWizardNext = function() {
  if (!bwStepValid(BWR.current)) return;
  BWR.completed.add(BWR.current);
  if (BWR.current < 6) BWR.current += 1;
  bwUpdateProgress();
  if (BWR.current === 6) bwRenderMockTrajectory();
};
window.bwWizardPrev = function() {
  if (BWR.current > 1) {
    BWR.current -= 1;
    bwUpdateProgress();
  }
};
window.bwTaskKey = function() {
  return (BWR.task || 'SOH Estimation').toLowerCase().includes('rul') ? 'rul' : 'soh';
};
window.bwSelectedModels = function() {
  return Array.from(BWR.models);
};
window.bwSelectedRawSignals = function() {
  return Array.from(BWR.signals);
};

window.bwFlowDownloadPackage = async function() {
  bwSyncPackageState();
  const btn = document.getElementById('bwr-download-btn');
  try {
    // Frontend scaffold export for now. Connect this handler to a backend package builder when available.
    const started = (typeof bwDownloadPackage === 'function') ? await bwDownloadPackage() : false;
    if (!started) return;
    if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
      window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'benchmarks_package' });
    }
    BWR.downloaded = true;
    if (btn) btn.textContent = 'Download Package (.zip)';
    document.getElementById('bwr-upload-card')?.classList.add('is-next');
    if (typeof showToast === 'function') showToast('Package prepared. Upload your local run output when training finishes.', 'success');
  } catch (err) {
    // If anything unexpected happens, don't claim the package is ready.
    if (typeof showToast === 'function') showToast('Download failed. Please try again in Chrome or Safari.', 'error');
  }
};
window.bwCopyTerminalCommand = async function() {
  const cmd = (document.getElementById('bw-terminal-command') || {}).textContent || '';
  const text = cmd.trim();
  if (!text) return;
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_) {}
  if (!copied) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    ta.remove();
  }
  const btn = document.getElementById('bwr-copy-btn');
  if (btn) {
    const old = btn.textContent;
    btn.textContent = copied ? 'Copied' : 'Select Text';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }
  if (typeof showToast === 'function') showToast(copied ? 'Terminal command copied.' : 'Copy unavailable. Select the command manually.', copied ? 'success' : 'info');
};
window.bwOpenUploadChooser = function() {
  const folder = document.getElementById('bw-outputs-folder');
  const files = document.getElementById('bw-outputs-files');
  (folder || files)?.click();
};
window.bwUploadDragOver = function(event) {
  event.preventDefault();
  document.getElementById('bwr-upload-box')?.classList.add('dragover');
};
window.bwUploadDragLeave = function(event) {
  event.preventDefault();
  document.getElementById('bwr-upload-box')?.classList.remove('dragover');
};
window.bwUploadDrop = function(event) {
  event.preventDefault();
  document.getElementById('bwr-upload-box')?.classList.remove('dragover');
  bwFlowMarkUploaded(Array.from(event.dataTransfer?.files || []));
};
window.bwFlowHandleUpload = function(event) {
  bwFlowMarkUploaded(Array.from(event.target.files || []));
  event.target.value = '';
};
function bwFlowMarkUploaded(files) {
  BWR.uploaded = true;
  const card = document.getElementById('bwr-upload-card');
  const status = document.getElementById('bwr-upload-status');
  if (card) card.classList.add('uploaded');
  if (status) status.textContent = files.length ? 'Upload ready: ' + files.length + ' item' + (files.length === 1 ? '' : 's') + ' selected.' : 'Upload ready: output folder selected.';
  if (typeof showToast === 'function') showToast('Output folder accepted for this local run.', 'success');
  bwUpdateProgress();
}
window.bwToggleExportMenu = function() {
  document.getElementById('bwr-export-dropdown')?.classList.toggle('open');
};
window.bwMockExport = function(label) {
  document.getElementById('bwr-export-dropdown')?.classList.remove('open');
  if (typeof showToast === 'function') showToast(label + ' export queued. Backend export can be connected later.', 'info');
};
window.bwRunAnotherBenchmark = function() {
  BWR.current = 1;
  BWR.completed.clear();
  BWR.task = '';
  BWR.datasetId = null;
  BWR.signals.clear();
  BWR.models.clear();
  BWR.downloaded = false;
  BWR.uploaded = false;
  BWR.splitError = false;
  BWR.splitProtocol = 'Manual';
  BWR.datasetPage = 1;
  BWR.filters = { q: '', all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() };
  BWR.pendingFilters = bwCloneFilterState(BWR.filters);
  BW.selId = null;
  document.querySelectorAll('#page-benchmarks .bw-flow .selected').forEach(el => el.classList.remove('selected'));
  const search = document.getElementById('bwr-ds-search');
  if (search) search.value = '';
  document.getElementById('bwr-upload-card')?.classList.remove('uploaded', 'is-next');
  const dl = document.getElementById('bwr-download-btn');
  if (dl) dl.textContent = 'Download Package (.zip)';
  const up = document.getElementById('bwr-upload-status');
  if (up) up.textContent = 'Waiting for local output folder';
  document.querySelectorAll('#page-benchmarks .bw-flow .bwr-split-protocol-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.bwrProtocol === 'Manual');
  });
  const randomCtrl = document.getElementById('bwr-random-ctrl');
  if (randomCtrl) randomCtrl.hidden = true;
  bwApplySplit(60, 20, 20);
  bwFlowRenderDatasets();
  bwUpdateProgress();
};

function bwMockTrajectoryRows() {
  const cell = document.getElementById('bwr-cell-select')?.value || 'Cell_01 (Tesla 2170)';
  const offset = cell.includes('02') ? .35 : cell.includes('03') ? -.25 : 0;
  return Array.from({ length: 16 }, (_, i) => {
    const cycle = 40 + i * 32;
    const truth = 99 - i * 1.28 + offset - Math.max(0, i - 8) * .22;
    const pred = truth + (Math.sin(i * 1.35) * .28) + .06;
    return { cycle, truth, pred };
  });
}
window.bwRenderMockTrajectory = function() {
  const host = document.getElementById('bwr-trajectory-chart');
  if (!host) return;
  const rows = bwMockTrajectoryRows();
  host.onmouseleave = bwHideChartTip;
  host.onmousemove = event => {
    if (!event.target.closest?.('.bwr-chart-hit')) bwHideChartTip();
  };
  const w = 820, h = 360, l = 64, r = 28, t = 30, b = 54;
  const xMin = rows[0].cycle, xMax = rows[rows.length - 1].cycle;
  const yMin = 76, yMax = 101;
  const x = v => l + (v - xMin) / (xMax - xMin) * (w - l - r);
  const y = v => t + (yMax - v) / (yMax - yMin) * (h - t - b);
  const line = key => rows.map(d => x(d.cycle).toFixed(1) + ',' + y(d[key]).toFixed(1)).join(' ');
  const yTicks = [80, 85, 90, 95, 100];
  const xTicks = [40, 168, 296, 424, 520];
  const areaPts = rows.map(d => x(d.cycle).toFixed(1) + ',' + y(d.pred).toFixed(1)).join(' ') + ' ' + x(rows[rows.length - 1].cycle).toFixed(1) + ',' + (h - b) + ' ' + x(rows[0].cycle).toFixed(1) + ',' + (h - b);
  const points = rows.map(d => {
    const err = Math.abs(d.pred - d.truth);
    const cx = x(d.cycle).toFixed(1);
    const cy = y(d.pred).toFixed(1);
    const args = [d.cycle, d.truth.toFixed(2), d.pred.toFixed(2), err.toFixed(2)].join(',');
    return '<circle class="bwr-chart-point" cx="' + cx + '" cy="' + cy + '" r="3.8" fill="#2563eb" stroke="#fff" stroke-width="1.6"></circle>'
      + '<circle class="bwr-chart-hit" cx="' + cx + '" cy="' + cy + '" r="10" fill="transparent" stroke="transparent" onmousemove="bwShowChartTip(event,' + args + ')"></circle>';
  }).join('');
  host.innerHTML = '<div class="bw-chart-tooltip" id="bwr-chart-tooltip"></div><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Per-cell prediction trajectory">'
    + '<defs><linearGradient id="bwrPredFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity=".20"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>'
    + yTicks.map(v => '<line class="bw-plot-grid" x1="' + l + '" y1="' + y(v).toFixed(1) + '" x2="' + (w - r) + '" y2="' + y(v).toFixed(1) + '"/><text class="bw-plot-label" x="' + (l - 10) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '%</text>').join('')
    + xTicks.map(v => '<text class="bw-plot-label" x="' + x(v).toFixed(1) + '" y="' + (h - 22) + '" text-anchor="middle">' + v + '</text>').join('')
    + '<line class="bw-plot-axis" x1="' + l + '" y1="' + t + '" x2="' + l + '" y2="' + (h - b) + '"/><line class="bw-plot-axis" x1="' + l + '" y1="' + (h - b) + '" x2="' + (w - r) + '" y2="' + (h - b) + '"/>'
    + '<polygon points="' + areaPts + '" fill="url(#bwrPredFade)"/>'
    + '<line x1="' + l + '" y1="' + y(80).toFixed(1) + '" x2="' + (w - r) + '" y2="' + y(80).toFixed(1) + '" stroke="#38bdf8" stroke-width="1.7" stroke-dasharray="6 5"/>'
    + '<polyline fill="none" stroke="#0f172a" stroke-width="2.5" points="' + line('truth') + '"/><polyline fill="none" stroke="#2563eb" stroke-width="2.6" points="' + line('pred') + '"/>'
    + points
    + '<text class="bw-plot-label" x="' + ((w + l - r) / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">Cycles</text>'
    + '<text class="bw-plot-label" x="17" y="' + ((h - b + t) / 2).toFixed(1) + '" text-anchor="middle" transform="rotate(-90 17 ' + ((h - b + t) / 2).toFixed(1) + ')">SOH (%)</text>'
    + '</svg>';
};
window.bwShowChartTip = function(event, cycle, truth, pred, err) {
  const tip = document.getElementById('bwr-chart-tooltip');
  const shell = document.getElementById('bwr-trajectory-chart');
  if (!tip || !shell) return;
  tip.innerHTML = 'Cycle: ' + cycle + '<br>True SOH: ' + truth.toFixed(2) + '%<br>Pred SOH: ' + pred.toFixed(2) + '%<br>Error: ' + err.toFixed(2) + '%';
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.style.display = 'block';
  const shellRect = shell.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = event.clientX - shellRect.left + shell.scrollLeft + 12;
  let top = event.clientY - shellRect.top + shell.scrollTop - tipRect.height - 12;
  if (top < shell.scrollTop + 8) top = event.clientY - shellRect.top + shell.scrollTop + 12;
  const maxLeft = shell.scrollLeft + shell.clientWidth - tipRect.width - 8;
  const maxTop = shell.scrollTop + shell.clientHeight - tipRect.height - 8;
  left = Math.max(shell.scrollLeft + 8, Math.min(left, maxLeft));
  top = Math.max(shell.scrollTop + 8, Math.min(top, maxTop));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
};
window.bwHideChartTip = function() {
  const tip = document.getElementById('bwr-chart-tooltip');
  if (tip) tip.style.display = 'none';
};

bwFlowInit();

/* ══════════════════════════════════════════════════════════════
   MODEL LIBRARY  — card grid + interactive detail panel
   ══════════════════════════════════════════════════════════════ */
const ML_ICONS = {
  linear: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  tree: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/>',
  boost: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  lstm: '<polyline points="2 12 5 12 7 5 11 19 14 9 16 12 22 12"/>',
  transformer: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 7l8 4M8 17l8-4"/>',
  cnn: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  pinn: '<circle cx="12" cy="12" r="2.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)"/>'
};
function mlIcon(k) { return '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">' + (ML_ICONS[k] || '') + '</svg>'; }
const ML_SVG = {
  star: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  dl: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  code: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  target: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  bars: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></svg>',
  file: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  ext: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  play: '<svg fill="currentColor" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  gpu: '<svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
};
const ML_GROUPS = [
  { name: 'Classical ML',    grad: 'linear-gradient(135deg,#2563eb,#1e40af)', icon: 'linear' },
  { name: 'Deep Learning',   grad: 'linear-gradient(135deg,#7c3aed,#6d28d9)', icon: 'transformer' },
  { name: 'Physics-Informed',grad: 'linear-gradient(135deg,#0d9488,#0f766e)', icon: 'pinn' }
];
const ML_STATUS = {
  'Available':    { cls: 'avail', dot: true },
  'Recommended':  { cls: 'rec',   dot: true },
  'Requires GPU': { cls: 'gpu',   bolt: true },
  'Experimental': { cls: 'exp',   dot: true }
};
const MODELS_LIB = [
  { id:'linear', name:'Linear Regression', sub:'Statistical', group:'Classical ML', icon:'linear',
    grad:'linear-gradient(135deg,#2563eb,#1e40af)', desc:'Linear model for baseline prediction of SOH and RUL.',
    tasks:['SOH','RUL'], status:'Available', framework:'scikit-learn', taskLabel:'SOH / RUL', difficulty:'Beginner', pyfile:'linear_regression.py',
    overview:'A transparent ordinary-least-squares baseline that maps engineered cycle features to a health target. Fast to fit and easy to interpret.',
    whenToUse:'Use as a sanity-check baseline and for quick feature-importance reads before reaching for heavier models.',
    inputs:['Per-cycle summary features (capacity, IR, CE)','Cycle index / time'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'Cycle features',s:'Q, IR, CE'},{t:'Normalize',s:'z-score'},{t:'Linear head',s:'w·x + b'},{t:'Prediction',s:'SOH / RUL'}],
    archNote:'Interpretable tabular baseline: standardized engineered features feed a single linear prediction head.',
    files:[{n:'model.py',d:'Linear model definition',s:'1.8 KB'},{n:'train.py',d:'Training script',s:'2.4 KB'},{n:'features.py',d:'Feature extraction',s:'3.1 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'0.7 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.4 KB'}] },
  { id:'rf', name:'Random Forest', sub:'Ensemble', group:'Classical ML', icon:'tree',
    grad:'linear-gradient(135deg,#16a34a,#15803d)', desc:'Ensemble of decision trees for robust performance on tabular features.',
    tasks:['SOH','RUL'], status:'Recommended', framework:'scikit-learn', taskLabel:'SOH / RUL', difficulty:'Intermediate', pyfile:'random_forest.py',
    overview:'Bagged decision-tree ensemble that handles non-linear feature interactions and is resilient to noisy, heterogeneous cycle data.',
    whenToUse:'A strong, low-tuning default for tabular SOH/RUL when you have engineered features and want robust accuracy.',
    inputs:['Per-cycle summary features','Optional statistical descriptors'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'Feature table',s:'cycle stats'},{t:'Bootstrap',s:'sample bags'},{t:'Decision trees',s:'parallel forest'},{t:'Average vote',s:'ensemble'},{t:'Prediction',s:'SOH / RUL'}],
    archNote:'Ensemble architecture: many independently trained trees vote or average to reduce variance on noisy battery features.',
    files:[{n:'model.py',d:'Random forest definition',s:'2.2 KB'},{n:'train.py',d:'Training script',s:'2.6 KB'},{n:'features.py',d:'Feature extraction',s:'3.1 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'0.9 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.4 KB'}] },
  { id:'xgboost', name:'XGBoost', sub:'Gradient Boosting', group:'Classical ML', icon:'boost',
    grad:'linear-gradient(135deg,#d97706,#b45309)', desc:'Gradient boosting framework for high-accuracy predictions.',
    tasks:['SOH','RUL'], status:'Recommended', framework:'XGBoost', taskLabel:'SOH / RUL', difficulty:'Intermediate', pyfile:'xgboost.py',
    overview:'Regularized gradient-boosted trees delivering top-tier accuracy on tabular features, with built-in handling of missing values.',
    whenToUse:'When you want the best tabular accuracy and are willing to tune learning rate, depth, and estimators.',
    inputs:['Per-cycle summary features','Optional dQ/dV descriptors'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'Feature table',s:'engineered'},{t:'Tree 1',s:'base learner'},{t:'Residual trees',s:'boosting'},{t:'Regularize',s:'shrinkage'},{t:'Prediction',s:'SOH / RUL'}],
    archNote:'Gradient boosting architecture: trees are added sequentially to correct residual error while regularization controls overfit.',
    files:[{n:'model.py',d:'XGBoost wrapper',s:'2.5 KB'},{n:'train.py',d:'Training + early stopping',s:'3.0 KB'},{n:'features.py',d:'Feature extraction',s:'3.1 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'1.1 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.5 KB'}] },
  { id:'lstm', name:'LSTM', sub:'Recurrent Neural Network', group:'Deep Learning', icon:'lstm',
    grad:'linear-gradient(135deg,#7c3aed,#6d28d9)', desc:'Captures temporal dependencies in battery degradation sequences.',
    tasks:['SOH','RUL'], status:'Requires GPU', framework:'PyTorch', taskLabel:'SOH / RUL', difficulty:'Advanced', pyfile:'lstm.py',
    overview:'A recurrent network that models long-range temporal structure directly from raw cycle time-series, learning degradation dynamics end-to-end.',
    whenToUse:'When sequential signal shape matters and enough labelled cells are available to train a deep model.',
    inputs:['Time-series of voltage, current, temperature','Cycle index and operating conditions'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'V/I/T(t)',s:'raw sequence'},{t:'Windowing',s:'cycle slices'},{t:'LSTM stack',s:'gates + memory'},{t:'Hidden state',s:'temporal code'},{t:'Dense head',s:'SOH / RUL'}],
    archNote:'Recurrent architecture: gated LSTM cells preserve degradation memory across cycle windows before a dense prediction head.',
    files:[{n:'model.py',d:'LSTM architecture',s:'4.4 KB'},{n:'train.py',d:'Training loop',s:'4.8 KB'},{n:'data.py',d:'Sequence data loaders',s:'3.3 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'1.2 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.6 KB'}] },
  { id:'transformer', name:'Transformer', sub:'Attention Model', group:'Deep Learning', icon:'transformer',
    grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)', desc:'Attention-based sequence model for long-range dependencies.',
    tasks:['SOH','RUL'], status:'Requires GPU', framework:'PyTorch', taskLabel:'SOH / RUL', difficulty:'Advanced', pyfile:'transformer.py',
    overview:'Self-attention encoder that relates distant cycles without recurrence, capturing global degradation patterns across the full history.',
    whenToUse:'For long sequences where attention over the whole trajectory outperforms step-by-step recurrence.',
    inputs:['Time-series of voltage, current, temperature','Positional / cycle encodings'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'Cycle tokens',s:'V/I/T + meta'},{t:'Position enc.',s:'cycle order'},{t:'Multi-head attn',s:'global context'},{t:'FFN encoder',s:'latent states'},{t:'Pooling head',s:'SOH / RUL'}],
    archNote:'Attention architecture: cycle tokens attend globally across the degradation trajectory, then pool into a task head.',
    files:[{n:'model.py',d:'Transformer encoder',s:'5.6 KB'},{n:'train.py',d:'Training loop',s:'4.9 KB'},{n:'data.py',d:'Sequence data loaders',s:'3.3 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'1.4 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.6 KB'}] },
  { id:'cnn', name:'CNN', sub:'Convolutional Neural Network', group:'Deep Learning', icon:'cnn',
    grad:'linear-gradient(135deg,#1e3a8a,#1e40af)', desc:'Extracts local patterns from time-series or 2D representations.',
    tasks:['SOH','RUL'], status:'Requires GPU', framework:'PyTorch', taskLabel:'SOH / RUL', difficulty:'Advanced', pyfile:'cnn.py',
    overview:'Convolutional network that learns local degradation motifs from 1D cycle signals or 2D voltage–capacity images.',
    whenToUse:'When informative local patterns (e.g. dQ/dV peaks) drive the target and you want efficient feature learning.',
    inputs:['Time-series windows or 2D V–Q maps','Operating conditions'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'Signal window',s:'1D / 2D map'},{t:'Conv blocks',s:'local filters'},{t:'Pooling',s:'downsample'},{t:'Flatten',s:'feature vector'},{t:'Dense head',s:'SOH / RUL'}],
    archNote:'Convolutional architecture: local filters capture peaks, slopes, and voltage-capacity motifs before dense regression.',
    files:[{n:'model.py',d:'CNN architecture',s:'4.0 KB'},{n:'train.py',d:'Training loop',s:'4.6 KB'},{n:'data.py',d:'Windowing + loaders',s:'3.5 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'1.1 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.6 KB'}] },
  { id:'pinn', name:'PINN', sub:'Physics-Informed Neural Network', group:'Physics-Informed', icon:'pinn',
    grad:'linear-gradient(135deg,#0d9488,#0f766e)', desc:'Incorporates physical laws to guide learning with limited data.',
    tasks:['SOH','RUL'], status:'Experimental', framework:'PyTorch', taskLabel:'SOH / RUL', difficulty:'Advanced', pyfile:'pinn.py',
    overview:'PINN models embed domain knowledge (e.g., electrochemical dynamics) into the loss function to improve generalization and data efficiency.',
    whenToUse:'Use PINN when labeled data is limited or when enforcing physical consistency improves model reliability.',
    inputs:['Time-series of voltage, current, temperature, etc.','Operating conditions and cycle metadata'],
    outputs:['State of Health (SOH)','Remaining Useful Life (RUL)'],
    arch:[{t:'V/I/T(t)',s:'observations'},{t:'Neural state',s:'latent dynamics'},{t:'Physics loss',s:'constraints'},{t:'Data loss',s:'labels'},{t:'Prediction',s:'SOH / RUL'}],
    archNote:'Physics-informed architecture: neural predictions are optimized against both observed labels and battery-physics residuals.',
    files:[{n:'model.py',d:'PINN model architecture',s:'6.2 KB'},{n:'train.py',d:'Training script',s:'4.1 KB'},{n:'data.py',d:'Data loading utilities',s:'2.8 KB'},{n:'config.yaml',d:'Default hyperparameters',s:'1.3 KB'},{n:'requirements.txt',d:'Python dependencies',s:'0.6 KB'}] }
];
const ML_PACKAGE_MODEL = {
  id: 'baseline-package',
  name: 'Baseline Models Package',
  sub: 'All Models',
  group: 'Package',
  icon: 'boost',
  grad: 'linear-gradient(135deg,#64748b,#475569)',
  desc: 'All models ready to use in a Python environment.',
  tasks: [],
  status: 'Package',
  framework: 'Python',
  taskLabel: 'All reference models',
  difficulty: 'Package',
  pyfile: 'baseline_models.zip',
  isPackage: true,
  overview: 'A single package containing the complete set of BatteryLake baseline model files for local Python use.',
  files: [
    { n:'baseline_models/', d:'Package root', s:'folder' },
    { n:'linear_regression.py', d:'Linear Regression implementation', s:'.py' },
    { n:'lstm.py', d:'LSTM implementation', s:'.py' },
    { n:'pinn.py', d:'PINN implementation', s:'.py' },
    { n:'random_forest.py', d:'Random Forest implementation', s:'.py' },
    { n:'transformer.py', d:'Transformer implementation', s:'.py' },
    { n:'utils.py', d:'Shared model utilities', s:'.py' },
    { n:'xgboost.py', d:'XGBoost implementation', s:'.py' },
    { n:'cnn.py', d:'CNN implementation', s:'.py' },
    { n:'README.md', d:'Package instructions', s:'.md' }
  ]
};

let mlSel = 'linear';
let activeModelFrameworks = new Set();
let activeModelStatuses = new Set();
let activeModelTasks = new Set();
let activeModelTypes = new Set();
let pendingModelFrameworks = new Set();
let pendingModelStatuses = new Set();
let pendingModelTasks = new Set();
let pendingModelTypes = new Set();

function mlStatusHTML(status) {
  const st = ML_STATUS[status] || { cls: '', dot: true };
  const mark = st.bolt ? ML_SVG.gpu : '<span class="ml-dot"></span>';
  return '<span class="ml-status ' + st.cls + '">' + mark + ' ' + status + '</span>';
}
function mlTasksHTML(m) {
  return '<span class="ml-tasklbl">Tasks</span>' + m.tasks.map(t => '<span class="ml-task">' + t + '</span>').join('');
}
function mlUsageCounts(m) {
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.getModelUsage === 'function') {
    return window.BatteryLakeAnalytics.getModelUsage(m && m.id);
  }
  return { downloads: 0, runs: 0 };
}
function mlFormatUsageCount(n, singular, plural) {
  const count = Number(n) || 0;
  return count + ' ' + (count === 1 ? singular : plural);
}
function mlUsageTagsHTML(m) {
  const usage = mlUsageCounts(m);
  const st = ML_STATUS[m.status] || { cls: '' };
  const badgeCls = 'ml-d-badge' + (st.cls ? ' ' + st.cls : '');
  return '<div class="ml-d-tags" aria-label="Model status and usage">'
    + '<span class="' + badgeCls + '">' + esc(m.status) + '</span>'
    + '<span class="ml-usage-tag ml-usage-downloads" data-ml-stat="downloads" data-model-id="' + escAttr(m.id) + '">' + mlFormatUsageCount(usage.downloads, 'download', 'downloads') + '</span>'
    + '<span class="ml-usage-tag ml-usage-runs" data-ml-stat="runs" data-model-id="' + escAttr(m.id) + '">' + mlFormatUsageCount(usage.runs, 'run', 'runs') + '</span>'
  + '</div>';
}
function mlDetailHeadHTML(m) {
  const iconHTML = m.isPackage ? ML_SVG.file : mlIcon(m.icon);
  return '<div class="ml-d-head">'
      + '<div class="ml-d-ic" style="background:' + m.grad + '">' + iconHTML + '</div>'
      + '<div class="ml-d-head-meta">'
        + '<div class="ml-d-head-copy">'
          + '<div class="ml-d-name">' + esc(m.name) + '</div>'
          + '<div class="ml-d-sub">' + esc(m.sub) + '</div>'
        + '</div>'
        + mlUsageTagsHTML(m)
      + '</div>'
      + '<button class="ml-d-close" onclick="showModelsPage()" title="Close">&times;</button>'
    + '</div>';
}
function mlCatalogModels() {
  return MODELS_LIB.concat([ML_PACKAGE_MODEL]);
}
function mlFindModel(id) {
  return mlCatalogModels().find(x => x.id === id);
}
const ML_CARD_LOGOS = {
  cnn: { light: 'assets/logos/models/1.png', dark: 'assets/logos/models/dark/1.png' },
  linear: { light: 'assets/logos/models/2.png', dark: 'assets/logos/models/dark/2.png' },
  lstm: { light: 'assets/logos/models/3.png', dark: 'assets/logos/models/dark/3.png' },
  pinn: { light: 'assets/logos/models/4.png', dark: 'assets/logos/models/dark/4.png' },
  rf: { light: 'assets/logos/models/5.png', dark: 'assets/logos/models/dark/5.png' },
  transformer: { light: 'assets/logos/models/6.png', dark: 'assets/logos/models/dark/6.png' },
  xgboost: { light: 'assets/logos/models/7.png', dark: 'assets/logos/models/dark/7.png' },
  'baseline-package': { light: 'assets/logos/models/8.png', dark: 'assets/logos/models/dark/8.png' }
};
function mlDownloadModel(id, source) {
  const m = mlFindModel(id);
  if (!m) return;
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackModelDownload === 'function') {
    window.BatteryLakeAnalytics.trackModelDownload({
      model_id: id,
      download_source: source === 'model_card' ? 'model_card' : 'model_detail'
    });
  }
  showToast(m.isPackage ? 'Preparing baseline_models.zip...' : 'Downloading ' + m.pyfile + ' ...', 'info');
}
function mlRunBenchmark(id) {
  if (!mlFindModel(id)) return;
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackModelRun === 'function') {
    window.BatteryLakeAnalytics.trackModelRun({ model_id: id });
  }
  showPage('benchmarks', document.querySelector('.sidebar-nav a[onclick*=benchmarks]'));
}
function mlCardHTML(m) {
  const logo = ML_CARD_LOGOS[m.id] || '';
  return '<div class="ml-card edge-glow-hover-effect" role="button" tabindex="0" data-id="' + m.id + '" onclick="mlOpenDetails(\'' + m.id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();mlOpenDetails(\'' + m.id + '\')}">'
    + '<div class="ml-card-head">'
      + '<div class="ml-card-head-copy">'
        + '<span class="ml-type-badge">' + esc(m.sub) + '</span>'
        + '<div class="ml-card-name">' + esc(m.name) + '</div>'
      + '</div>'
      + (logo ? '<span class="ml-card-logo" aria-hidden="true"><img class="ml-card-logo-light" src="' + logo.light + '" alt=""><img class="ml-card-logo-dark" src="' + logo.dark + '" alt=""></span>' : '')
    + '</div>'
    + '<div class="ml-card-desc">' + esc(m.desc) + '</div>'
    + '<div class="ml-card-actions">'
      + '<span class="ml-card-arrow" aria-hidden="true"><svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></span>'
      + '<button class="ml-download-icon" type="button" onclick="event.stopPropagation();mlDownloadModel(\'' + m.id + '\', \'model_card\')" aria-label="Download ' + escAttr(m.name) + (m.isPackage ? ' package' : ' Python file') + '" title="' + (m.isPackage ? 'Download package' : 'Download .py') + '">' + ML_SVG.dl + '</button>'
    + '</div>'
  + '</div>';
}
function mlWideCardHTML(m) {
  return mlCardHTML(m);
}
function mlVal(id) { const e = document.getElementById(id); return e ? e.value : ''; }
function mlCloneSet(set) { return new Set(Array.from(set)); }
function mlHasSearchText() {
  const input = document.getElementById('ml-search');
  return !!(input && input.value.trim());
}
function mlHasAppliedFilters() {
  return activeModelFrameworks.size > 0 || activeModelStatuses.size > 0 || activeModelTasks.size > 0 || activeModelTypes.size > 0;
}
function mlIsResultsMode() {
  return mlHasSearchText() || mlHasAppliedFilters();
}
function mlSyncPendingFromActive() {
  pendingModelFrameworks = mlCloneSet(activeModelFrameworks);
  pendingModelStatuses = mlCloneSet(activeModelStatuses);
  pendingModelTasks = mlCloneSet(activeModelTasks);
  pendingModelTypes = mlCloneSet(activeModelTypes);
  mlSyncFilterPopupTags();
}
function mlSyncFilterPopupTags() {
  document.querySelectorAll('[data-ml-framework]').forEach(t => t.classList.toggle('active', pendingModelFrameworks.has(t.dataset.mlFramework)));
  document.querySelectorAll('[data-ml-status]').forEach(t => t.classList.toggle('active', pendingModelStatuses.has(t.dataset.mlStatus)));
  document.querySelectorAll('[data-ml-task]').forEach(t => t.classList.toggle('active', pendingModelTasks.has(t.dataset.mlTask)));
  document.querySelectorAll('[data-ml-type]').forEach(t => t.classList.toggle('active', pendingModelTypes.has(t.dataset.mlType)));
}
function mlUpdatePendingSet(set, value, el) {
  if (set.has(value)) set.delete(value); else set.add(value);
  el.classList.toggle('active', set.has(value));
}
function mlToggleFrameworkFilter(el) { mlUpdatePendingSet(pendingModelFrameworks, el.dataset.mlFramework, el); }
function mlToggleStatusFilter(el) { mlUpdatePendingSet(pendingModelStatuses, el.dataset.mlStatus, el); }
function mlToggleTaskFilter(el) { mlUpdatePendingSet(pendingModelTasks, el.dataset.mlTask, el); }
function mlToggleTypeFilter(el) { mlUpdatePendingSet(pendingModelTypes, el.dataset.mlType, el); }
function mlToggleFilters() {
  const popover = document.getElementById('model-filter-popover');
  const btn = document.querySelector('.model-filter-toggle');
  if (!popover) return;
  const willOpen = !popover.classList.contains('open');
  if (willOpen) mlSyncPendingFromActive();
  popover.classList.toggle('open', willOpen);
  if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}
function mlCloseFilters() {
  const popover = document.getElementById('model-filter-popover');
  const btn = document.querySelector('.model-filter-toggle');
  if (popover) popover.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function mlApplyFilters() {
  activeModelFrameworks = mlCloneSet(pendingModelFrameworks);
  activeModelStatuses = mlCloneSet(pendingModelStatuses);
  activeModelTasks = mlCloneSet(pendingModelTasks);
  activeModelTypes = mlCloneSet(pendingModelTypes);
  mlCloseFilters();
  mlRenderAppliedFilterChips();
  mlRender();
}
function mlClearFilters() {
  pendingModelFrameworks.clear();
  pendingModelStatuses.clear();
  pendingModelTasks.clear();
  pendingModelTypes.clear();
  activeModelFrameworks.clear();
  activeModelStatuses.clear();
  activeModelTasks.clear();
  activeModelTypes.clear();
  mlSyncFilterPopupTags();
  mlRenderAppliedFilterChips();
  mlRender();
  mlCloseFilters();
}
function mlRenderAppliedFilterChips() {
  const box = document.getElementById('ml-applied-filter-chips');
  if (!box) return;
  const chips = [];
  activeModelFrameworks.forEach(v => chips.push({ type: 'framework', tokenType: 'domain', value: v, label: v }));
  activeModelStatuses.forEach(v => chips.push({ type: 'status', tokenType: 'status', value: v, label: v }));
  activeModelTasks.forEach(v => chips.push({ type: 'task', tokenType: 'profile', value: v, label: v }));
  activeModelTypes.forEach(v => chips.push({ type: 'type', tokenType: 'category', value: v, label: v }));
  box.classList.toggle('has-chips', chips.length > 0);
  box.innerHTML = chips.map(chip => `<span class="applied-chip ${filterTypeClass(chip.tokenType)}">${esc(chip.label)}<button aria-label="Remove ${esc(chip.label)} filter" onclick="mlRemoveAppliedFilter('${chip.type}','${escAttr(chip.value)}')">×</button></span>`).join('');
}
function mlRemoveAppliedFilter(type, value) {
  if (type === 'framework') activeModelFrameworks.delete(value);
  if (type === 'status') activeModelStatuses.delete(value);
  if (type === 'task') activeModelTasks.delete(value);
  if (type === 'type') activeModelTypes.delete(value);
  mlSyncPendingFromActive();
  mlRenderAppliedFilterChips();
  mlRender();
}
function mlOnSearchInput() {
  const input = document.getElementById('ml-search');
  const box = document.getElementById('ml-search-box');
  if (box) box.classList.toggle('has-text', !!(input && input.value));
  mlRender();
}
function mlClearSearch() {
  const input = document.getElementById('ml-search');
  if (input) {
    input.value = '';
    input.focus();
  }
  const box = document.getElementById('ml-search-box');
  if (box) box.classList.remove('has-text');
  mlRender();
}
function mlFilteredModels() {
  const q = (mlVal('ml-search') || '').trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  return mlCatalogModels().filter(m => {
    if (activeModelFrameworks.size > 0 && !activeModelFrameworks.has(m.framework)) return false;
    if (activeModelStatuses.size > 0 && !activeModelStatuses.has(m.status)) return false;
    if (activeModelTypes.size > 0 && !activeModelTypes.has(m.sub)) return false;
    if (activeModelTasks.size > 0) {
      let taskMatch = false;
      activeModelTasks.forEach(t => { if (m.tasks.includes(t)) taskMatch = true; });
      if (!taskMatch) return false;
    }
    if (tokens.length) {
      const hay = [m.name, m.sub, m.desc, m.framework, m.group, m.status, m.taskLabel].join(' ').toLowerCase();
      for (const t of tokens) {
        if (!hay.includes(t)) return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (a.isPackage && !b.isPackage) return 1;
    if (!a.isPackage && b.isPackage) return -1;
    return a.name.localeCompare(b.name);
  });
}
function mlRender() {
  const groupsEl = document.getElementById('ml-groups'); if (!groupsEl) return;
  const list = mlFilteredModels();
  let html = '';
  const cards = list.map(mlCardHTML).join('');
  if (cards) html = '<div class="ml-group"><div class="ml-cards">' + cards + '</div></div>';
  groupsEl.innerHTML = html || '<div style="padding:44px;text-align:center;color:var(--text3)">No models match your filters.</div>';
  const count = document.getElementById('ml-count');
  const head = document.querySelector('#page-models .model-results-head');
  const resultsMode = mlIsResultsMode();
  if (head) head.classList.toggle('has-results', resultsMode);
  if (count) count.textContent = resultsMode ? list.length + (list.length === 1 ? ' model found' : ' models found') : '';
}
function mlArchitectureHTML(m) {
  const layers = m.arch || [];
  if (!layers.length) return '';
  const colors = {
    linear: ['#2a5fea', '#eaf1ff'],
    rf: ['#15a05a', '#e8f8ef'],
    xgboost: ['#d9810a', '#fff4e3'],
    lstm: ['#7a45e6', '#f1ecfe'],
    transformer: ['#7a45e6', '#f1ecfe'],
    cnn: ['#1e40af', '#eaf1ff'],
    pinn: ['#0e9b8e', '#e5f7f4']
  };
  const c = colors[m.id] || ['#2a5fea', '#eaf1ff'];
  const stageW = 377, nodeW = 82, nodeH = 72, startX = 14;
  const gap = layers.length > 1 ? (stageW - startX * 2 - nodeW) / (layers.length - 1) : 0;
  const points = layers.map((layer, i) => ({
    x: startX + i * gap,
    y: 118 - (i % 2 ? 44 : 0)
  }));
  const rails = points.slice(0, -1).map((p, i) => {
    const n = points[i + 1];
    const x1 = p.x + nodeW - 5;
    const y1 = p.y + nodeH / 2;
    const x2 = n.x + 8;
    const y2 = n.y + nodeH / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(18, Math.sqrt(dx * dx + dy * dy));
    const rot = Math.atan2(dy, dx) * 180 / Math.PI;
    return '<span class="ml-arch3d-rail" style="--x:' + x1.toFixed(1) + 'px;--y:' + y1.toFixed(1) + 'px;--w:' + len.toFixed(1) + 'px;--rot:' + rot.toFixed(2) + 'deg"></span>';
  }).join('');
  const nodes = layers.map((layer, i) => {
    const p = points[i];
    const delay = (i * 45) + 'ms';
    const bars = Array.from({ length: Math.min(4, i + 2) }).map(() => '<span></span>').join('');
    return '<div class="ml-arch3d-node ' + (i === layers.length - 1 ? 'output' : '') + '" style="--x:' + p.x.toFixed(1) + 'px;--y:' + p.y.toFixed(1) + 'px;--delay:' + delay + ';z-index:' + (i + 3) + '">'
      + '<span class="ml-arch3d-face depth"></span>'
      + '<span class="ml-arch3d-face side"></span>'
      + '<div class="ml-arch3d-card">'
        + '<div class="ml-arch3d-mini">' + bars + '</div>'
        + '<strong>' + esc(layer.t) + '</strong>'
        + '<em>' + esc(layer.s) + '</em>'
      + '</div>'
    + '</div>';
  }).join('');
  return '<div class="ml-arch ml-arch3d" style="--arch-accent:' + c[0] + ';--arch-tint:' + c[1] + '">'
    + '<div class="ml-arch3d-head"><span class="ml-arch3d-title">' + esc(m.name) + ' 3D structure</span><span class="ml-arch3d-meta">input / latent / head</span></div>'
    + '<div class="ml-arch3d-stage" role="img" aria-label="' + esc(m.name) + ' professional 3D architecture diagram">'
      + '<span class="ml-arch3d-floor"></span>'
      + rails + nodes
    + '</div>'
    + '<div class="ml-arch-caption">' + esc(m.archNote || '') + '</div>'
  + '</div>';
}
function mlDetailHTML(m) {
  if (m.isPackage) return mlPackageDetailHTML(m);
  return mlDetailHeadHTML(m)
    + '<div class="ml-d-chips">'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.code + ' Framework</span><span class="ml-chip-v">' + m.framework + '</span></div>'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.target + ' Task</span><span class="ml-chip-v">' + m.taskLabel + '</span></div>'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.bars + ' Difficulty</span><span class="ml-chip-v diff-' + m.difficulty + '">' + m.difficulty + '</span></div>'
    + '</div>'
    + '<div class="ml-d-body">'
      + '<div class="ml-d-sec"><div class="ml-d-h">Overview</div><p>' + m.overview + '</p></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Architecture Diagram</div>' + mlArchitectureHTML(m) + '</div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">When to Use</div><p>' + m.whenToUse + '</p></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Input Requirements</div><ul>' + m.inputs.map(i => '<li>' + i + '</li>').join('') + '</ul></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Output</div><ul>' + m.outputs.map(o => '<li>' + o + '</li>').join('') + '</ul></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Included Files</div><div class="ml-files">'
        + m.files.map(f => '<div class="ml-file"><span class="ml-file-ic">' + ML_SVG.file + '</span><span class="ml-file-n">' + f.n + '</span><span class="ml-file-d">' + f.d + '</span><span class="ml-file-s">' + f.s + '</span></div>').join('')
      + '</div></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Quick Actions</div><div class="ml-actions">'
        + '<button class="ml-btn ml-btn-primary" onclick="mlDownloadModel(\'' + m.id + '\', \'model_detail\')">' + ML_SVG.dl + ' Download Code</button>'
        + '<button class="ml-btn ml-btn-ghost" onclick="showToast(\'Opening ' + m.name + ' docs…\', \'info\')">' + ML_SVG.ext + ' Docs</button>'
        + '<button class="ml-btn ml-btn-ghost" onclick="mlRunBenchmark(\'' + m.id + '\')">' + ML_SVG.play + ' Run Benchmark</button>'
      + '</div></div>'
    + '</div>';
}
function mlPackageDetailHTML(m) {
  return mlDetailHeadHTML(m)
    + '<div class="ml-d-chips">'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.code + ' Format</span><span class="ml-chip-v">Python package</span></div>'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.target + ' Coverage</span><span class="ml-chip-v">All baseline models</span></div>'
      + '<div class="ml-chip"><span class="ml-chip-k">' + ML_SVG.bars + ' Files</span><span class="ml-chip-v">' + m.files.length + ' items</span></div>'
    + '</div>'
    + '<div class="ml-d-body">'
      + '<div class="ml-d-sec"><div class="ml-d-h">Overview</div><p>' + esc(m.overview) + '</p></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Included Files</div><div class="ml-files ml-package-files">'
        + m.files.map(f => '<div class="ml-file"><span class="ml-file-ic">' + ML_SVG.file + '</span><span class="ml-file-n">' + esc(f.n) + '</span><span class="ml-file-d">' + esc(f.d) + '</span><span class="ml-file-s">' + esc(f.s) + '</span></div>').join('')
      + '</div></div>'
      + '<div class="ml-d-sec"><div class="ml-d-h">Quick Actions</div><div class="ml-actions">'
        + '<button class="ml-btn ml-btn-primary" onclick="mlDownloadModel(\'' + m.id + '\', \'model_detail\')">' + ML_SVG.dl + ' Download Package</button>'
        + '<button class="ml-btn ml-btn-ghost" onclick="mlRunBenchmark(\'' + m.id + '\')">' + ML_SVG.play + ' Run Benchmark</button>'
      + '</div></div>'
    + '</div>';
}
function mlSelect(id) {
  const m = mlFindModel(id); if (!m) return;
  mlSel = id;
  const det = document.getElementById('ml-detail');
  if (det) det.innerHTML = mlDetailHTML(m);
  const wrap = document.getElementById('ml-wrap'); if (wrap) wrap.classList.remove('no-detail');
  document.querySelectorAll('.ml-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  if (det && window.innerWidth <= 1080) det.scrollTop = 0;
}
function mlOpenDetails(id) {
  const m = mlFindModel(id); if (!m) return;
  mlSel = id;
  renderModelDetailsPage(id);
  showPage('model-details', document.getElementById('nav-models'), { preserveHash: true });
  history.pushState(null, '', '#model-' + id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderModelDetailsPage(id) {
  const m = mlFindModel(id) || MODELS_LIB[0];
  if (!m) return;
  mlSel = m.id;
  const page = document.getElementById('model-detail-page-content');
  if (page) page.innerHTML = mlDetailHTML(m);
}
function showModelsPage() {
  showPage('models', document.getElementById('nav-models'), { preserveHash: true });
  history.pushState(null, '', '#models');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function mlCloseDetail() {
  const wrap = document.getElementById('ml-wrap'); if (wrap) wrap.classList.add('no-detail');
  document.querySelectorAll('.ml-card.active').forEach(c => c.classList.remove('active'));
}
function mlClear() {
  mlClearFilters();
  mlClearSearch();
  mlRender();
}
function mlInit() {
  if (!document.getElementById('ml-groups')) return;
  window.mlLibraryReady = true;
  mlRenderAppliedFilterChips();
  mlRender();
  if (pendingInitialModelId && mlCatalogModels().some(m => m.id === pendingInitialModelId)) {
    renderModelDetailsPage(pendingInitialModelId);
    showPage('model-details', document.getElementById('nav-models'), { preserveHash: true });
  }
}
mlInit();

/* ══════════════════════════════════════════════════════════════
   QUALITY ASSESSMENT PAGE
   ══════════════════════════════════════════════════════════════ */
const QA_CHECK_DEFS = [
  { key: 'voltage_range', name: 'Voltage Range Validation', detail: 'All cell voltages within 2.0V-4.5V nominal operating range for the stated chemistry.' },
  { key: 'energy_balance', name: 'Energy Balance Check', detail: 'Charge/discharge energy integral consistency; coulombic efficiency remains within 95-105% per cycle.' },
  { key: 'capacity_mono', name: 'Capacity Monotonicity', detail: 'Degradation trajectory follows expected non-increasing trend with allowable recovery windows.' },
  { key: 'temperature_consistency', name: 'Temperature Consistency', detail: 'Cell surface temperature must remain within 5°C of stated test condition.' },
  { key: 'timestamp_integrity', name: 'Timestamp Integrity', detail: 'Monotonically increasing timestamps with no negative intervals or unreasonable gaps above 24h.' },
  { key: 'current_direction', name: 'Current Direction Consistency', detail: 'Charge and discharge current signs follow one convention throughout the dataset.' }
];

const QA_DEFAULT_REPORT = {
  dataset_id: 'dataset_03',
  file_name: 'dataset_03_quality_assesment.json',
  quality_score: { completeness: 0.97, consistency: 0.95, accuracy: 0.92, validity: 1.00 },
  overall: 0.96,
  gate: 'ready_with_warning',
  checks_detail: QA_CHECK_DEFS.map(def => ({ ...def, status: def.key === 'temperature_consistency' ? 'warn' : 'pass' })),
  checks: [
    { name: 'voltage_range', passed: true },
    { name: 'temperature_consistency', status: 'review' },
    { name: 'capacity_mono', passed: true }
  ],
  warn_count: 1,
  generated_at: '2026-04-28T12:00:00Z'
};

let qaSelectedFile = null;
let qaLastReport = QA_DEFAULT_REPORT;
let qaActiveDatasetId = null;
let qaPageInitialized = false;
let qaHasAssessed = false;

function qaHashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}
function qaSeededRandom(seed) {
  let s = seed;
  return function () { s = (s * 1103515245 + 12345) >>> 0; return (s % 10000) / 10000; };
}

function updateQualitySelectedFile() {
  const note = document.getElementById('qaSelectedFile');
  const runBtn = document.getElementById('qaRunBtn');
  const dropZone = document.getElementById('qaDropZone');
  const dropTitle = dropZone?.querySelector('.drop-title');
  if (qaSelectedFile) {
    const sizeKb = (qaSelectedFile.size / 1024).toFixed(1);
    if (note) {
      note.textContent = `${qaSelectedFile.name} · ${sizeKb} KB`;
      note.classList.add('has-files');
    }
    if (dropTitle) dropTitle.textContent = qaSelectedFile.name;
    if (runBtn) runBtn.disabled = false;
    if (dropZone) dropZone.classList.add('has-files');
  } else {
    if (note) { note.textContent = 'No file selected.'; note.classList.remove('has-files'); }
    if (dropTitle) dropTitle.textContent = 'Upload a dataset to assess';
    if (runBtn) runBtn.disabled = true;
    if (dropZone) dropZone.classList.remove('has-files');
  }
}

function handleQualityFileInput(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  qaSelectedFile = file;
  updateQualitySelectedFile();
}

const qaDropZoneEl = document.getElementById('qaDropZone');
if (qaDropZoneEl) {
  ['dragenter', 'dragover'].forEach(type => {
    qaDropZoneEl.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      qaDropZoneEl.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    qaDropZoneEl.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      if (type === 'dragleave' && qaDropZoneEl.contains(event.relatedTarget)) return;
      qaDropZoneEl.classList.remove('dragging');
    });
  });
  qaDropZoneEl.addEventListener('drop', event => {
    const file = Array.from(event.dataTransfer?.files || [])[0];
    if (!file) { showToast('No file was dropped.', 'error'); return; }
    qaSelectedFile = file;
    updateQualitySelectedFile();
  });
}

function generateQualityReport(file) {
  const rand = qaSeededRandom(qaHashSeed(file.name + '_' + file.size));
  const dims = {
    completeness: Math.min(1, Math.round((0.90 + rand() * 0.09) * 100) / 100),
    consistency: Math.min(1, Math.round((0.88 + rand() * 0.11) * 100) / 100),
    accuracy: Math.min(1, Math.round((0.85 + rand() * 0.14) * 100) / 100),
    validity: Math.min(1, Math.round((0.94 + rand() * 0.06) * 100) / 100)
  };
  const overall = Math.round(((dims.completeness + dims.consistency + dims.accuracy + dims.validity) / 4) * 100) / 100;

  const checksDetail = QA_CHECK_DEFS.map(def => ({ ...def, status: rand() < 0.16 ? 'warn' : 'pass' }));
  const warnCount = checksDetail.filter(c => c.status === 'warn').length;
  const gate = warnCount === 0 ? 'ready' : 'ready_with_warning';
  const datasetId = file.name.replace(/\.[^.]+$/, '') || 'uploaded_dataset';

  return {
    dataset_id: datasetId,
    file_name: file.name,
    quality_score: dims,
    overall,
    gate,
    checks_detail: checksDetail,
    checks: checksDetail.map(c => c.status === 'pass' ? { name: c.key, passed: true } : { name: c.key, status: 'review' }),
    warn_count: warnCount,
    generated_at: new Date().toISOString()
  };
}

function qaDiagIcon(status) {
  return status === 'pass'
    ? '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'
    : '<svg fill="none" stroke="currentColor" stroke-width="2.1" viewBox="0 0 24 24"><path d="M12 7v6"/><path d="M12 17h.01"/><path d="M10.3 4.6h3.4L21 19H3z"/></svg>';
}

function qaGateLabel(report) {
  return report.gate === 'ready' ? 'Ready' : 'Ready with warning';
}

function setQualityExampleMode(isExample) {
  const results = document.getElementById('qaResults');
  if (results) results.classList.toggle('qa-is-example', !!isExample);

  let badge = document.getElementById('qaExampleBadge');
  if (!badge && results) {
    badge = document.createElement('span');
    badge.id = 'qaExampleBadge';
    badge.className = 'qa-example-badge';
    badge.textContent = 'Example Data';
    const info = document.querySelector('#qaResultsBar .qa-results-info');
    if (info) info.insertAdjacentElement('afterbegin', badge);
    else results.insertAdjacentElement('afterbegin', badge);
  }
  if (!badge) return;

  if (isExample) {
    badge.hidden = false;
    badge.removeAttribute('hidden');
    badge.style.display = '';
  } else {
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    badge.style.display = 'none';
  }
}

function renderQualityResults(report, options = {}) {
  const isExample = options.isExample === true;
  setQualityExampleMode(isExample);
  const dims = report.quality_score;

  Object.entries(dims).forEach(([dim, score]) => {
    const card = document.querySelector(`.quality-card[data-dim="${dim}"]`);
    if (!card) return;
    const scoreEl = card.querySelector('.qc-score');
    if (scoreEl) scoreEl.textContent = score.toFixed(2);
    const bar = card.querySelector('.qa-progress');
    if (bar) bar.style.setProperty('--score', Math.round(score * 100) + '%');
    const footVal = card.querySelectorAll('.qa-card-foot span')[1];
    if (footVal) {
      if (dim === 'completeness') footVal.textContent = ((1 - score) * 100).toFixed(1) + '%';
      if (dim === 'consistency') footVal.textContent = Math.max(0, Math.round((1 - score) * 55)) + ' flags';
      if (dim === 'accuracy') footVal.textContent = `${QA_CHECK_DEFS.length - report.warn_count} / ${QA_CHECK_DEFS.length} pass`;
      if (dim === 'validity') footVal.textContent = String(Math.round((1 - score) * 20));
    }
  });

  const ring = document.getElementById('qaOverallRing');
  if (ring) ring.style.setProperty('--pct', Math.round(report.overall * 100));
  const overallScoreEl = document.getElementById('qaOverallScore');
  if (overallScoreEl) overallScoreEl.textContent = report.overall.toFixed(2);

  const gateLabel = qaGateLabel(report);
  const warnLabel = `${report.warn_count} warning${report.warn_count === 1 ? '' : 's'}`;
  [['qaOverallGateChip', 'qaOverallWarnChip'], ['qaGateChip', 'qaGateWarnChip']].forEach(([gateId, warnId]) => {
    const gateEl = document.getElementById(gateId);
    const warnEl = document.getElementById(warnId);
    if (gateEl) gateEl.textContent = gateLabel;
    if (warnEl) { warnEl.style.display = report.warn_count ? '' : 'none'; warnEl.textContent = warnLabel; }
  });

  const fileEl = document.getElementById('qaResultsFile');
  if (fileEl) fileEl.textContent = report.file_name;
  const timeEl = document.getElementById('qaResultsTime');
  if (timeEl) timeEl.textContent = 'Assessed ' + new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const passCount = report.checks_detail.filter(c => c.status === 'pass').length;
  const badge = document.getElementById('qaDiagBadge');
  if (badge) badge.textContent = `${passCount} passed - ${warnLabel}`;

  const list = document.getElementById('qaDiagList');
  if (list) {
    list.innerHTML = report.checks_detail.map(c => `
      <li class="diag-item ${c.status}">
        <div class="diag-icon ${c.status}">${qaDiagIcon(c.status)}</div>
        <div><div class="diag-name">${esc(c.name)}</div><div class="diag-detail">${esc(c.detail)}</div></div>
      </li>`).join('');
  }

  const code = document.getElementById('qaCode');
  if (code) {
    const checksJson = report.checks.map(c => c.passed
      ? `    { <span class="k">"name"</span>: "${esc(c.name)}", <span class="k">"passed"</span>: true }`
      : `    { <span class="k">"name"</span>: "${esc(c.name)}", <span class="k">"status"</span>: <span class="w">"review"</span> }`
    ).join(',\n');
    code.innerHTML = `{
  <span class="k">"dataset_id"</span>: "${esc(report.dataset_id)}",
  <span class="k">"quality_score"</span>: {
    <span class="qa-line" data-dim="completeness"><span class="k">"completeness"</span>: <span class="n">${dims.completeness.toFixed(2)}</span></span>,
    <span class="qa-line" data-dim="consistency"><span class="k">"consistency"</span>: <span class="n">${dims.consistency.toFixed(2)}</span></span>,
    <span class="qa-line" data-dim="accuracy"><span class="k">"accuracy"</span>: <span class="n">${dims.accuracy.toFixed(2)}</span></span>,
    <span class="qa-line" data-dim="validity"><span class="k">"validity"</span>: <span class="n">${dims.validity.toFixed(2)}</span></span>
  },
  <span class="k">"overall"</span>: <span class="n">${report.overall.toFixed(2)}</span>,
  <span class="k">"gate"</span>: "${report.gate}",
  <span class="k">"checks"</span>: [
${checksJson}
  ],
  <span class="k">"generated_at"</span>: "${report.generated_at}"
}`;
  }
}

function runQualityAssessment() {
  if (!qaSelectedFile) { showToast('Choose a dataset file first.', 'error'); return; }
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
    window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'quality_assessment' });
  }
  const runBtn = document.getElementById('qaRunBtn');
  const originalLabel = runBtn ? runBtn.textContent : 'Run Assessment';
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Analyzing...'; }
  showToast('Running quality assessment...', 'info', 1600);

  (async () => {
    const stem = String(qaSelectedFile.name || '').replace(/\.[^.]+$/, '');
    let report = await loadQualityReport(stem);
    if (!report) {
      const match = DATASETS.find(d =>
        d.id === stem ||
        d.ref_name === stem ||
        stem === d.id + '_timeseries' ||
        stem === d.ref_name + '_timeseries'
      );
      if (match) report = await loadQualityReport(match.id);
    }
    // Path A offline fallback when no precomputed report exists for this file.
    if (!report) report = generateQualityReport(qaSelectedFile);

    qaLastReport = report;
    qaActiveDatasetId = report.dataset_id || stem;
    qaHasAssessed = true;
    renderQualityResults(report, { isExample: false });
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = originalLabel; }
    showToast('Assessment complete - report ready to download.', 'success');
    document.getElementById('qaResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  })().catch(() => {
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = originalLabel; }
    showToast('Quality assessment failed.', 'error');
  });
}

function downloadQualityReport() {
  const report = qaLastReport || QA_DEFAULT_REPORT;
  const payload = {
    dataset_id: report.dataset_id,
    file_name: report.file_name,
    quality_score: report.quality_score,
    overall: report.overall,
    gate: report.gate,
    checks: report.checks,
    warn_count: report.warn_count,
    generated_at: report.generated_at
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${report.dataset_id || 'quality_report'}_quality_report.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Quality report downloaded.', 'success');
}

/** Path A — fetch a precomputed report; returns null if none exists yet. */
async function loadQualityReport(datasetId) {
  if (!datasetId) return null;
  const candidates = [datasetId];
  const match = DATASETS.find(d => d.id === datasetId || d.ref_name === datasetId);
  if (match) {
    if (!candidates.includes(match.id)) candidates.push(match.id);
    if (match.ref_name && !candidates.includes(match.ref_name)) candidates.push(match.ref_name);
  }
  for (const id of candidates) {
    try {
      const res = await fetch(`quality_reports/${id}_quality_report.json`, { cache: 'no-store' });
      if (!res.ok) continue;
      return await res.json();
    } catch { /* try next candidate */ }
  }
  return null;
}

async function showDatasetQuality(datasetId) {
  const nav = document.querySelector('.sidebar-nav a[onclick*="quality"]');
  showPage('quality', nav, { preserveHash: true, skipQualityLoad: true });
  if (datasetId) history.replaceState(null, '', '#quality-' + datasetId);
  else history.replaceState(null, '', '#quality');

  document.getElementById('qaCatalogSelect')?.closest('.qa-catalog-picker')?.remove();

  const report = await loadQualityReport(datasetId);
  if (report) {
    qaLastReport = report;
    qaActiveDatasetId = datasetId;
    qaHasAssessed = true;
    qaPageInitialized = true;
    renderQualityResults(report, { isExample: false });
    document.getElementById('qaResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return report;
  }
  showToast('No precomputed quality report for this dataset yet.', 'info');
  return null;
}

async function ensureQualityPageReady(datasetId) {
  // Remove any leftover catalog picker from earlier builds.
  document.getElementById('qaCatalogSelect')?.closest('.qa-catalog-picker')?.remove();

  // Deep-link / modal: load a real catalog report and clear the example label.
  if (datasetId) {
    const report = await loadQualityReport(datasetId);
    if (report) {
      qaLastReport = report;
      qaActiveDatasetId = datasetId;
      qaHasAssessed = true;
      qaPageInitialized = true;
      renderQualityResults(report, { isExample: false });
      return;
    }
  }

  if (qaPageInitialized && qaHasAssessed) return;
  qaPageInitialized = true;
  qaHasAssessed = false;
  qaLastReport = QA_DEFAULT_REPORT;
  renderQualityResults(QA_DEFAULT_REPORT, { isExample: true });
}

window.handleQualityFileInput = handleQualityFileInput;
window.runQualityAssessment = runQualityAssessment;
window.downloadQualityReport = downloadQualityReport;
window.loadQualityReport = loadQualityReport;
window.showDatasetQuality = showDatasetQuality;

// Ensure Example data badge + results mode are correct once this block has loaded.
(function initQualityPageOnReady() {
  const hash = (location.hash || '').replace(/^#/, '');
  const deepId = hash.startsWith('quality-') || hash.startsWith('quality/')
    ? hash.replace(/^quality[-/]/, '')
    : null;
  if (deepId) {
    void ensureQualityPageReady(deepId);
    return;
  }
  if (document.getElementById('page-quality')?.classList.contains('active') || hash === 'quality') {
    void ensureQualityPageReady(null);
    return;
  }
  setQualityExampleMode(true);
})();
