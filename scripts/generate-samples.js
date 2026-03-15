#!/usr/bin/env node

/**
 * generate-samples.js
 *
 * Generates 5 sample vendor PDFs in ../sample-documents/ using pdfkit.
 * These documents contain realistic content for testing the VendorGuard
 * classification and risk-extraction pipeline.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'sample-documents');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDoc(filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  return { doc, stream, filePath };
}

function title(doc, text) {
  doc.fontSize(18).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(0.5);
}

function subtitle(doc, text) {
  doc.fontSize(13).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(0.5);
}

function sectionHeader(doc, text) {
  doc.moveDown(0.4);
  doc.fontSize(12).font('Helvetica-Bold').text(text);
  doc.moveDown(0.2);
}

function body(doc, text) {
  doc.fontSize(10).font('Helvetica').text(text, { align: 'left', lineGap: 2 });
}

function bodyCenter(doc, text) {
  doc.fontSize(10).font('Helvetica').text(text, { align: 'center', lineGap: 2 });
}

function separator(doc) {
  doc.moveDown(0.3);
  doc.moveTo(60, doc.y).lineTo(552, doc.y).stroke('#cccccc');
  doc.moveDown(0.3);
}

function finalize(doc, stream, filePath) {
  return new Promise((resolve) => {
    stream.on('finish', () => {
      console.log(`  Created: ${filePath}`);
      resolve();
    });
    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Sample 1 - Mutual NDA
// ---------------------------------------------------------------------------

function generateNDA() {
  const { doc, stream, filePath } = createDoc('nda_acme_corp.pdf');

  title(doc, 'MUTUAL NON-DISCLOSURE AGREEMENT');
  doc.moveDown(0.3);

  body(doc, 'This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of June 15, 2025 (the "Effective Date"), by and between:');
  doc.moveDown(0.5);

  body(doc, 'Party A: Acme Corporation, a Delaware corporation, with its principal office at 123 Business Ave, Suite 400, Wilmington, DE 19801 ("Acme");');
  doc.moveDown(0.3);
  body(doc, 'Party B: TechVentures Inc., a California corporation, with its principal office at 500 Innovation Drive, San Francisco, CA 94105 ("TechVentures");');
  doc.moveDown(0.3);
  body(doc, '(each a "Party" and collectively the "Parties").');
  doc.moveDown(0.5);

  body(doc, 'WHEREAS, the Parties wish to explore a potential business relationship (the "Purpose") and, in connection therewith, each Party may disclose to the other certain confidential and proprietary information;');
  doc.moveDown(0.3);
  body(doc, 'NOW, THEREFORE, in consideration of the mutual promises and covenants contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:');

  sectionHeader(doc, '1. DEFINITION OF CONFIDENTIAL INFORMATION');
  body(doc, '"Confidential Information" means any non-public information disclosed by either Party ("Disclosing Party") to the other Party ("Receiving Party"), whether orally, in writing, electronically, or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, without limitation, trade secrets, business plans, financial information, customer lists, technical data, product designs, software code, algorithms, inventions, know-how, marketing strategies, and any analyses, compilations, studies, or other documents prepared by the Receiving Party that contain or reflect such information.');

  sectionHeader(doc, '2. EXCLUSIONS FROM CONFIDENTIAL INFORMATION');
  body(doc, 'Confidential Information does not include information that:\n\n(a) is or becomes publicly available through no fault of the Receiving Party;\n(b) was already in the Receiving Party\'s possession without restriction before disclosure by the Disclosing Party;\n(c) is independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information;\n(d) is rightfully received from a third party without restriction on disclosure; or\n(e) is required to be disclosed by law, regulation, or court order, provided that the Receiving Party gives prompt written notice to the Disclosing Party to allow the Disclosing Party to seek a protective order.');

  sectionHeader(doc, '3. OBLIGATIONS OF RECEIVING PARTY');
  body(doc, 'The Receiving Party shall: (a) hold the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third party except to its employees, contractors, and advisors who have a need to know and are bound by confidentiality obligations no less restrictive than those herein; (c) use the Confidential Information solely for the Purpose; and (d) protect the Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.');

  sectionHeader(doc, '4. TERM AND TERMINATION');
  body(doc, 'This Agreement shall be effective as of the Effective Date and shall remain in effect until June 15, 2027 (the "Expiration Date"), unless earlier terminated by either Party upon thirty (30) days\' prior written notice to the other Party. The confidentiality obligations set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years following such expiration or termination.');

  sectionHeader(doc, '5. NON-COMPETE');
  body(doc, 'During the term of this Agreement and for a period of twelve (12) months following its termination, neither Party shall, directly or indirectly, engage in any business activity that is substantially competitive with the other Party\'s core business operations as disclosed under this Agreement, within the geographic regions where the other Party operates.');

  sectionHeader(doc, '6. NON-SOLICITATION');
  body(doc, 'During the term of this Agreement and for a period of twelve (12) months following its termination, neither Party shall, directly or indirectly, solicit, recruit, or hire any employee, contractor, or consultant of the other Party who was involved in or had access to the Confidential Information exchanged under this Agreement.');

  sectionHeader(doc, '7. RETURN OF MATERIALS');
  body(doc, 'Upon the expiration or termination of this Agreement, or upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all tangible materials containing or embodying Confidential Information, including all copies, summaries, and derivative works thereof, and shall certify in writing to the Disclosing Party that it has done so.');

  sectionHeader(doc, '8. INJUNCTIVE RELIEF');
  body(doc, 'Each Party acknowledges that any breach of this Agreement may cause irreparable harm to the Disclosing Party for which monetary damages would be an inadequate remedy. Accordingly, the Disclosing Party shall be entitled to seek injunctive or other equitable relief to enforce the terms of this Agreement, in addition to any other remedies available at law or in equity.');

  sectionHeader(doc, '9. GOVERNING LAW');
  body(doc, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be subject to the exclusive jurisdiction of the state and federal courts located in the State of Delaware.');

  sectionHeader(doc, '10. ENTIRE AGREEMENT');
  body(doc, 'This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior or contemporaneous oral or written agreements, representations, or understandings. This Agreement may not be modified except by a written instrument signed by both Parties.');

  doc.moveDown(1);
  separator(doc);
  doc.moveDown(0.5);

  body(doc, 'IN WITNESS WHEREOF, the Parties have executed this Mutual Non-Disclosure Agreement as of the Effective Date.');
  doc.moveDown(1);

  doc.fontSize(10).font('Helvetica-Bold').text('ACME CORPORATION');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Signature: /s/ John A. Smith');
  body(doc, 'Name: John A. Smith');
  body(doc, 'Title: Chief Executive Officer');
  body(doc, 'Date: June 15, 2025');

  doc.moveDown(1);

  doc.fontSize(10).font('Helvetica-Bold').text('TECHVENTURES INC.');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Signature: /s/ Sarah L. Chen');
  body(doc, 'Name: Sarah L. Chen');
  body(doc, 'Title: Vice President, Partnerships');
  body(doc, 'Date: June 15, 2025');

  return finalize(doc, stream, filePath);
}

// ---------------------------------------------------------------------------
// Sample 2 - W-9
// ---------------------------------------------------------------------------

function generateW9() {
  const { doc, stream, filePath } = createDoc('w9_acme_corp.pdf');

  // Header area
  doc.fontSize(8).font('Helvetica').text('Form W-9', 60, 60);
  doc.fontSize(7).font('Helvetica').text('(Rev. March 2024)', 60, 70);
  doc.fontSize(7).font('Helvetica').text('Department of the Treasury', 60, 80);
  doc.fontSize(7).font('Helvetica').text('Internal Revenue Service', 60, 90);

  doc.fontSize(14).font('Helvetica-Bold').text('Request for Taxpayer', 180, 60, { width: 300, align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').text('Identification Number and Certification', 180, 78, { width: 300, align: 'center' });

  doc.fontSize(8).font('Helvetica').text('Give Form to the', 470, 60);
  doc.fontSize(8).font('Helvetica').text('requester. Do not', 470, 70);
  doc.fontSize(8).font('Helvetica').text('send to the IRS.', 470, 80);

  // Separator
  doc.moveTo(60, 105).lineTo(552, 105).lineWidth(2).stroke('#000000');
  doc.moveDown(2);
  doc.y = 115;

  sectionHeader(doc, '1. Name (as shown on your income tax return)');
  body(doc, 'Acme Corporation');
  doc.moveDown(0.3);

  sectionHeader(doc, '2. Business name/disregarded entity name, if different from above');
  body(doc, 'Acme Corp LLC');
  doc.moveDown(0.3);

  sectionHeader(doc, '3. Federal tax classification');
  body(doc, 'Check the appropriate box:');
  doc.moveDown(0.2);
  body(doc, '[ ] Individual/sole proprietor or single-member LLC');
  body(doc, '[X] C Corporation');
  body(doc, '[ ] S Corporation');
  body(doc, '[ ] Partnership');
  body(doc, '[ ] Trust/estate');
  body(doc, '[ ] Limited liability company. Enter the tax classification: ____');
  body(doc, '[ ] Other (see instructions): ____');
  doc.moveDown(0.3);

  sectionHeader(doc, '4. Exemptions');
  body(doc, 'Exempt payee code (if any): N/A');
  body(doc, 'Exemption from FATCA reporting code (if any): N/A');
  doc.moveDown(0.3);

  sectionHeader(doc, '5. Address (number, street, and apt. or suite no.)');
  body(doc, '123 Business Ave, Suite 400');
  doc.moveDown(0.3);

  sectionHeader(doc, '6. City, state, and ZIP code');
  body(doc, 'Wilmington, DE 19801');
  doc.moveDown(0.3);

  sectionHeader(doc, '7. List account number(s) here (optional)');
  body(doc, 'N/A');
  doc.moveDown(0.3);

  sectionHeader(doc, "8. Requester's name and address (optional)");
  body(doc, 'TechVentures Inc.');
  body(doc, '500 Innovation Drive');
  body(doc, 'San Francisco, CA 94105');

  separator(doc);

  sectionHeader(doc, 'Part I: Taxpayer Identification Number (TIN)');
  body(doc, 'Enter your TIN in the appropriate box. For individuals, this is generally your social security number (SSN). For other entities, it is your employer identification number (EIN).');
  doc.moveDown(0.3);
  body(doc, 'Social security number: N/A');
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica-Bold').text('Employer identification number (EIN): XX-XXX3456');
  doc.moveDown(0.3);

  separator(doc);

  sectionHeader(doc, 'Part II: Certification');
  body(doc, 'Under penalties of perjury, I certify that:\n\n1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and\n\n2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and\n\n3. I am a U.S. citizen or other U.S. person (defined in the instructions); and\n\n4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.');

  doc.moveDown(0.5);
  separator(doc);

  doc.fontSize(10).font('Helvetica-Bold').text('Signature');
  doc.moveDown(0.3);
  body(doc, 'Signature: /s/ John A. Smith');
  body(doc, 'Date: May 20, 2025');
  doc.moveDown(0.2);
  body(doc, 'Print Name: John A. Smith');
  body(doc, 'Title: Chief Executive Officer');

  return finalize(doc, stream, filePath);
}

// ---------------------------------------------------------------------------
// Sample 3 - Certificate of Insurance (COI)
// ---------------------------------------------------------------------------

function generateCOI() {
  const { doc, stream, filePath } = createDoc('coi_acme_corp.pdf');

  doc.fontSize(8).font('Helvetica').text('ACORD 25 (2016/03)', { align: 'right' });
  doc.moveDown(0.3);

  title(doc, 'CERTIFICATE OF LIABILITY INSURANCE');
  subtitle(doc, 'THIS CERTIFICATE IS ISSUED AS A MATTER OF INFORMATION ONLY AND CONFERS NO RIGHTS UPON THE CERTIFICATE HOLDER.');

  doc.fontSize(8).font('Helvetica').text('THIS CERTIFICATE DOES NOT AFFIRMATIVELY OR NEGATIVELY AMEND, EXTEND, OR ALTER THE COVERAGE AFFORDED BY THE POLICIES BELOW.', { align: 'center' });
  doc.moveDown(0.5);

  separator(doc);

  // Producer info
  doc.fontSize(10).font('Helvetica-Bold').text('PRODUCER:');
  body(doc, 'Wilmington Insurance Brokers LLC');
  body(doc, '789 Insurance Row, Suite 200');
  body(doc, 'Wilmington, DE 19801');
  body(doc, 'Phone: (302) 555-0100  Fax: (302) 555-0101');

  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('INSURED:');
  body(doc, 'Acme Corporation');
  body(doc, '123 Business Ave, Suite 400');
  body(doc, 'Wilmington, DE 19801');

  doc.moveDown(0.5);
  separator(doc);

  doc.fontSize(10).font('Helvetica-Bold').text('INSURER(S) AFFORDING COVERAGE');
  doc.moveDown(0.3);
  body(doc, 'INSURER A: National Insurance Co          NAIC#: 12345');
  body(doc, 'INSURER B: ______________________________  NAIC#: ______');

  doc.moveDown(0.5);
  separator(doc);

  sectionHeader(doc, 'COVERAGES');
  doc.fontSize(8).font('Helvetica').text('THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD INDICATED.');

  doc.moveDown(0.5);

  // Table-like layout for coverages
  doc.fontSize(9).font('Helvetica-Bold').text('TYPE OF INSURANCE          POLICY NUMBER         EFF DATE       EXP DATE        LIMITS');
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica-Bold').text('COMMERCIAL GENERAL LIABILITY');
  doc.fontSize(9).font('Helvetica').text('  [X] Occurrence             GL-2025-78901        01/01/2025     12/31/2025');
  doc.moveDown(0.2);
  body(doc, '  EACH OCCURRENCE                                                           $2,000,000');
  body(doc, '  DAMAGE TO RENTED PREMISES (Ea occurrence)                                 $  500,000');
  body(doc, '  MEDICAL EXPENSE (Any one person)                                          $   10,000');
  body(doc, '  PERSONAL & ADVERTISING INJURY                                             $2,000,000');
  body(doc, '  GENERAL AGGREGATE                                                         $4,000,000');
  body(doc, '  PRODUCTS - COMPLETED OPERATIONS AGGREGATE                                 $2,000,000');

  doc.moveDown(0.4);

  doc.fontSize(9).font('Helvetica-Bold').text('AUTOMOBILE LIABILITY');
  doc.fontSize(9).font('Helvetica').text('  [X] Any Auto               AU-2025-78902        01/01/2025     12/31/2025');
  doc.moveDown(0.2);
  body(doc, '  COMBINED SINGLE LIMIT (Ea accident)                                      $1,000,000');
  body(doc, '  BODILY INJURY (Per person)                                                $  500,000');
  body(doc, '  BODILY INJURY (Per accident)                                              $1,000,000');

  doc.moveDown(0.4);

  doc.fontSize(9).font('Helvetica-Bold').text("WORKERS COMPENSATION AND EMPLOYERS' LIABILITY");
  doc.fontSize(9).font('Helvetica').text('  [X] Statutory              WC-2025-78903        01/01/2025     12/31/2025');
  doc.moveDown(0.2);
  body(doc, '  EACH ACCIDENT                                                             $  500,000');
  body(doc, '  DISEASE - EACH EMPLOYEE                                                   $  500,000');
  body(doc, '  DISEASE - POLICY LIMIT                                                    $  500,000');

  doc.moveDown(0.5);
  separator(doc);

  sectionHeader(doc, 'DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES');
  body(doc, 'TechVentures Inc. is included as Additional Insured with respect to the operations of the Named Insured per written contract or agreement. Coverage is primary and non-contributory.');

  doc.moveDown(0.5);
  separator(doc);

  sectionHeader(doc, 'CERTIFICATE HOLDER');
  doc.moveDown(0.3);
  body(doc, 'TechVentures Inc.');
  body(doc, '500 Innovation Drive');
  body(doc, 'San Francisco, CA 94105');

  doc.moveDown(0.5);

  body(doc, 'SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.');

  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text('AUTHORIZED REPRESENTATIVE');
  doc.moveDown(0.3);
  body(doc, 'Signature: /s/ Robert M. Williams');
  body(doc, 'Date: January 15, 2025');

  return finalize(doc, stream, filePath);
}

// ---------------------------------------------------------------------------
// Sample 4 - SOC 2 Type II Report
// ---------------------------------------------------------------------------

function generateSOC2() {
  const { doc, stream, filePath } = createDoc('soc2_acme_corp.pdf');

  // Cover page
  doc.moveDown(4);
  title(doc, 'SOC 2 TYPE II REPORT');
  doc.moveDown(0.5);
  subtitle(doc, 'Service Organization Controls Report');
  doc.moveDown(1);

  bodyCenter(doc, 'Prepared for:');
  doc.fontSize(14).font('Helvetica-Bold').text('Acme Corporation', { align: 'center' });
  doc.moveDown(1);

  bodyCenter(doc, 'Report on Controls at a Service Organization');
  bodyCenter(doc, 'Relevant to Security, Availability, and Confidentiality');
  doc.moveDown(1);

  bodyCenter(doc, 'For the Period:');
  doc.fontSize(12).font('Helvetica-Bold').text('January 1, 2024 to December 31, 2024', { align: 'center' });
  doc.moveDown(2);

  bodyCenter(doc, 'Prepared by:');
  doc.fontSize(12).font('Helvetica-Bold').text('Anderson & Associates CPAs', { align: 'center' });
  bodyCenter(doc, 'Certified Public Accountants');
  bodyCenter(doc, '1200 Accounting Plaza, Suite 800');
  bodyCenter(doc, 'New York, NY 10001');

  doc.addPage();

  // Independent Auditor's Report
  title(doc, 'INDEPENDENT SERVICE AUDITOR\'S REPORT');
  doc.moveDown(0.5);

  body(doc, 'To the Management of Acme Corporation:');
  doc.moveDown(0.5);

  sectionHeader(doc, 'Scope');
  body(doc, 'We have examined Acme Corporation\'s ("Acme" or the "Company") description of its cloud-based software platform system (the "System") as of December 31, 2024, and the suitability of the design and operating effectiveness of controls relevant to the trust services criteria for security, availability, and confidentiality (the "Trust Services Criteria") established by the American Institute of Certified Public Accountants ("AICPA") set forth in TSP Section 100, 2017 Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy, throughout the period January 1, 2024 to December 31, 2024 (the "Audit Period").');

  doc.moveDown(0.5);

  sectionHeader(doc, 'Service Organization\'s Responsibilities');
  body(doc, 'Acme Corporation is responsible for: (1) preparing the description of the System and its assertion that the description is fairly presented; (2) the suitability of the design of controls; (3) the operating effectiveness of controls; and (4) establishing criteria for evaluating the controls.');

  sectionHeader(doc, 'Service Auditor\'s Responsibilities');
  body(doc, 'Our responsibility is to express an opinion on the fairness of the presentation of the description and on the suitability of the design and operating effectiveness of controls, based on our examination. We conducted our examination in accordance with attestation standards established by the AICPA.');

  sectionHeader(doc, 'Opinion');
  body(doc, 'In our opinion, in all material respects:');
  doc.moveDown(0.3);
  body(doc, '(a) The description fairly presents the System that was designed and implemented throughout the period January 1, 2024 to December 31, 2024;');
  doc.moveDown(0.2);
  body(doc, '(b) The controls stated in the description were suitably designed to provide reasonable assurance that the applicable trust services criteria would be met if the controls operated effectively throughout the period January 1, 2024 to December 31, 2024; and');
  doc.moveDown(0.2);
  body(doc, '(c) The controls operated effectively to provide reasonable assurance that the applicable trust services criteria were met throughout the period January 1, 2024 to December 31, 2024.');

  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Opinion Type: Unqualified');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text('Exceptions Noted: None');
  doc.moveDown(0.5);

  sectionHeader(doc, 'Trust Services Criteria Covered');
  body(doc, '  - Security: The system is protected against unauthorized access (both physical and logical).');
  body(doc, '  - Availability: The system is available for operation and use as committed or agreed.');
  body(doc, '  - Confidentiality: Information designated as confidential is protected as committed or agreed.');
  doc.moveDown(0.5);

  separator(doc);

  sectionHeader(doc, 'Summary of Controls Tested');
  body(doc, 'Total controls tested: 142');
  body(doc, 'Controls operating effectively: 142');
  body(doc, 'Controls with exceptions: 0');
  body(doc, 'Exception rate: 0%');

  doc.moveDown(1);

  body(doc, 'Anderson & Associates CPAs');
  body(doc, 'Certified Public Accountants');
  doc.moveDown(0.3);
  body(doc, 'Signature: /s/ Michael T. Anderson, CPA');
  body(doc, 'Partner');
  body(doc, 'Date: February 15, 2025');

  return finalize(doc, stream, filePath);
}

// ---------------------------------------------------------------------------
// Sample 5 - Business License
// ---------------------------------------------------------------------------

function generateBusinessLicense() {
  const { doc, stream, filePath } = createDoc('business_license_acme.pdf');

  // Decorative border
  doc.rect(50, 50, 512, 692).lineWidth(3).stroke('#003366');
  doc.rect(55, 55, 502, 682).lineWidth(1).stroke('#003366');

  doc.moveDown(2);

  // Header
  doc.fontSize(11).font('Helvetica').text('STATE OF DELAWARE', { align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').text('CITY OF WILMINGTON', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Office of the City Clerk', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Department of Licenses and Inspections', { align: 'center' });
  doc.moveDown(0.3);

  separator(doc);
  doc.moveDown(0.5);

  doc.fontSize(22).font('Helvetica-Bold').text('GENERAL BUSINESS LICENSE', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(11).font('Helvetica').text('This certifies that the business entity named below has been duly licensed', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('to conduct business in the City of Wilmington, State of Delaware,', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('subject to all applicable laws, ordinances, and regulations.', { align: 'center' });

  doc.moveDown(1.5);

  // License details in a structured format
  const leftCol = 120;
  const rightCol = 260;

  doc.fontSize(10).font('Helvetica-Bold').text('License Number:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('BL-2024-12345', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('License Type:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('General Business License', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Entity Name:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('Acme Corporation', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('DBA:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('N/A', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Business Address:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('123 Business Ave, Suite 400', rightCol, doc.y - 12);
  doc.fontSize(10).font('Helvetica').text('Wilmington, DE 19801', rightCol, doc.y);
  doc.moveDown(0.8);

  doc.fontSize(10).font('Helvetica-Bold').text('NAICS Code:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('541511 - Custom Computer Programming Services', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Issue Date:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('March 1, 2024', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Expiration Date:', leftCol, doc.y);
  doc.fontSize(10).font('Helvetica').text('March 1, 2026', rightCol, doc.y - 12);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Status:', leftCol, doc.y);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#006600').text('ACTIVE', rightCol, doc.y - 14);
  doc.fillColor('#000000');
  doc.moveDown(1.5);

  separator(doc);
  doc.moveDown(0.5);

  body(doc, 'This license is issued pursuant to the Wilmington City Code, Title 15, Chapter 3. This license is non-transferable and must be displayed at the principal place of business. Failure to renew before the expiration date may result in penalties and late fees.');
  doc.moveDown(0.5);

  body(doc, 'This license does not exempt the holder from compliance with any other federal, state, or local laws, rules, regulations, or requirements, including but not limited to zoning, health, building, and fire safety codes.');

  doc.moveDown(1.5);

  // Signatures
  doc.fontSize(10).font('Helvetica').text('_________________________________', 80, doc.y);
  doc.fontSize(10).font('Helvetica').text('_________________________________', 340, doc.y - 12);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('Patricia M. Johnson', 80, doc.y);
  doc.fontSize(9).font('Helvetica').text('David R. Thompson', 340, doc.y - 10);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('City Clerk', 80, doc.y);
  doc.fontSize(9).font('Helvetica').text('Director, Licenses & Inspections', 340, doc.y - 10);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('Date: March 1, 2024', 80, doc.y);

  return finalize(doc, stream, filePath);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Generating sample vendor documents...\n');

  await generateNDA();
  await generateW9();
  await generateCOI();
  await generateSOC2();
  await generateBusinessLicense();

  console.log('\nDone! All sample PDFs generated in:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error generating samples:', err);
  process.exit(1);
});
