export interface TemplateItem {
  expression: string;
  label: string;
  description: string;
}

export interface TemplateCategory {
  name: string;
  icon: string;
  items: TemplateItem[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    name: 'Request Data',
    icon: '{}',
    items: [
      { expression: '{{request.url}}', label: 'Request URL', description: 'Full request URL with query string' },
      { expression: '{{request.path}}', label: 'Request Path', description: 'URL path without query string' },
      { expression: "{{request.pathSegments.[0]}}", label: 'Path Segment', description: 'URL path segment by index (0-based)' },
      { expression: "{{request.query.paramName}}", label: 'Query Parameter', description: 'Query parameter value by name' },
      { expression: '{{request.method}}', label: 'Request Method', description: 'HTTP method (GET, POST, etc.)' },
      { expression: "{{request.headers.Header-Name}}", label: 'Request Header', description: 'Header value by name' },
      { expression: '{{request.body}}', label: 'Request Body', description: 'Full request body as string' },
      { expression: "{{jsonPath request.body '$.field'}}", label: 'JSON Path', description: 'Extract value from JSON body' },
      { expression: '{{request.clientIp}}', label: 'Client IP', description: 'Client IP address' },
      { expression: '{{request.baseUrl}}', label: 'Base URL', description: 'Server base URL' },
    ],
  },
  {
    name: 'Built-in Helpers',
    icon: 'fn',
    items: [
      { expression: '{{now}}', label: 'Current Timestamp', description: 'ISO 8601 timestamp' },
      { expression: "{{now format='yyyy-MM-dd'}}", label: 'Formatted Date', description: 'Current date with custom format' },
      { expression: "{{randomValue type='UUID'}}", label: 'Random UUID', description: 'Random UUID v4' },
      { expression: "{{randomValue type='ALPHANUMERIC' length=16}}", label: 'Random String', description: 'Random alphanumeric string' },
      { expression: "{{randomValue type='NUMERIC' length=8}}", label: 'Random Number', description: 'Random numeric string' },
      { expression: "{{randomInt lower=1 upper=100}}", label: 'Random Integer', description: 'Random integer in range' },
      { expression: "{{math 1 '+' 1}}", label: 'Math Operation', description: 'Arithmetic: +, -, *, /, %' },
      { expression: "{{#if (contains request.url 'test')}}yes{{else}}no{{/if}}", label: 'Conditional', description: 'If/else block' },
    ],
  },
  {
    name: 'Name',
    icon: 'Aa',
    items: [
      { expression: "{{random 'Name.firstName'}}", label: 'First Name', description: 'Random first name' },
      { expression: "{{random 'Name.lastName'}}", label: 'Last Name', description: 'Random last name' },
      { expression: "{{random 'Name.fullName'}}", label: 'Full Name', description: 'Random full name' },
      { expression: "{{random 'Name.nameWithMiddle'}}", label: 'Name with Middle', description: 'Full name with middle name' },
      { expression: "{{random 'Name.prefix'}}", label: 'Prefix', description: 'Name prefix (Mr., Mrs.)' },
      { expression: "{{random 'Name.suffix'}}", label: 'Suffix', description: 'Name suffix (Jr., Sr.)' },
    ],
  },
  {
    name: 'Internet',
    icon: '@',
    items: [
      { expression: "{{random 'Internet.emailAddress'}}", label: 'Email', description: 'Random email address' },
      { expression: "{{random 'Internet.safeEmailAddress'}}", label: 'Safe Email', description: 'Safe email (example.com)' },
      { expression: "{{random 'Internet.url'}}", label: 'URL', description: 'Random URL' },
      { expression: "{{random 'Internet.domainName'}}", label: 'Domain', description: 'Random domain name' },
      { expression: "{{random 'Internet.ipV4Address'}}", label: 'IPv4', description: 'Random IPv4 address' },
      { expression: "{{random 'Internet.ipV6Address'}}", label: 'IPv6', description: 'Random IPv6 address' },
      { expression: "{{random 'Internet.macAddress'}}", label: 'MAC Address', description: 'Random MAC address' },
      { expression: "{{random 'Internet.uuid'}}", label: 'UUID', description: 'Random UUID' },
      { expression: "{{random 'Internet.password'}}", label: 'Password', description: 'Random password' },
    ],
  },
  {
    name: 'Phone',
    icon: '#',
    items: [
      { expression: "{{random 'PhoneNumber.phoneNumber'}}", label: 'Phone Number', description: 'Random phone number' },
      { expression: "{{random 'PhoneNumber.cellPhone'}}", label: 'Cell Phone', description: 'Random cell phone number' },
    ],
  },
  {
    name: 'Address',
    icon: 'Addr',
    items: [
      { expression: "{{random 'Address.streetAddress'}}", label: 'Street', description: 'Street address' },
      { expression: "{{random 'Address.city'}}", label: 'City', description: 'City name' },
      { expression: "{{random 'Address.state'}}", label: 'State', description: 'State name' },
      { expression: "{{random 'Address.stateAbbr'}}", label: 'State Abbr', description: 'State abbreviation' },
      { expression: "{{random 'Address.zipCode'}}", label: 'ZIP Code', description: 'ZIP/postal code' },
      { expression: "{{random 'Address.country'}}", label: 'Country', description: 'Country name' },
      { expression: "{{random 'Address.latitude'}}", label: 'Latitude', description: 'Random latitude' },
      { expression: "{{random 'Address.longitude'}}", label: 'Longitude', description: 'Random longitude' },
    ],
  },
  {
    name: 'Company',
    icon: 'Co',
    items: [
      { expression: "{{random 'Company.name'}}", label: 'Company Name', description: 'Random company name' },
      { expression: "{{random 'Company.industry'}}", label: 'Industry', description: 'Random industry' },
      { expression: "{{random 'Company.bs'}}", label: 'Buzzword', description: 'Business buzzword phrase' },
      { expression: "{{random 'Job.title'}}", label: 'Job Title', description: 'Random job title' },
      { expression: "{{random 'Job.field'}}", label: 'Job Field', description: 'Random job field' },
      { expression: "{{random 'Commerce.department'}}", label: 'Department', description: 'Department name' },
      { expression: "{{random 'Commerce.productName'}}", label: 'Product Name', description: 'Random product name' },
      { expression: "{{random 'Commerce.price'}}", label: 'Price', description: 'Random price' },
    ],
  },
  {
    name: 'Finance',
    icon: '$',
    items: [
      { expression: "{{random 'Finance.creditCard'}}", label: 'Credit Card', description: 'Credit card number' },
      { expression: "{{random 'Finance.iban'}}", label: 'IBAN', description: 'International bank account number' },
      { expression: "{{random 'Finance.bic'}}", label: 'BIC/SWIFT', description: 'Bank identifier code' },
    ],
  },
  {
    name: 'Date & Time',
    icon: 'DT',
    items: [
      { expression: "{{random 'DateAndTime.birthday'}}", label: 'Birthday', description: 'Random birthday' },
      { expression: "{{random 'TimeAndDate.future'}}", label: 'Future Date', description: 'Random future ISO date' },
      { expression: "{{random 'TimeAndDate.past'}}", label: 'Past Date', description: 'Random past ISO date' },
    ],
  },
  {
    name: 'Text',
    icon: 'Tx',
    items: [
      { expression: "{{random 'Lorem.word'}}", label: 'Word', description: 'Random word' },
      { expression: "{{random 'Lorem.sentence'}}", label: 'Sentence', description: 'Random sentence' },
      { expression: "{{random 'Lorem.paragraph'}}", label: 'Paragraph', description: 'Random paragraph' },
      { expression: "{{random 'Lorem.characters'}}", label: 'Characters', description: 'Random characters' },
    ],
  },
  {
    name: 'Entertainment',
    icon: 'En',
    items: [
      { expression: "{{random 'Book.title'}}", label: 'Book Title', description: 'Random book title' },
      { expression: "{{random 'Book.author'}}", label: 'Book Author', description: 'Random book author' },
      { expression: "{{random 'Music.genre'}}", label: 'Music Genre', description: 'Random music genre' },
      { expression: "{{random 'Food.ingredient'}}", label: 'Ingredient', description: 'Food ingredient' },
      { expression: "{{random 'Beer.name'}}", label: 'Beer Name', description: 'Random beer name' },
      { expression: "{{random 'Coffee.blendName'}}", label: 'Coffee Blend', description: 'Coffee blend name' },
    ],
  },
  {
    name: 'Barcodes & IDs',
    icon: '|||',
    items: [
      { expression: "{{random 'Barcode.ean13'}}", label: 'EAN-13', description: 'EAN-13 barcode (13 digits)' },
      { expression: "{{random 'Barcode.ean8'}}", label: 'EAN-8', description: 'EAN-8 barcode (8 digits)' },
      { expression: "{{random 'Code.isbn10'}}", label: 'ISBN-10', description: 'ISBN-10 book identifier' },
      { expression: "{{random 'Code.isbn13'}}", label: 'ISBN-13', description: 'ISBN-13 book identifier' },
      { expression: "{{random 'NL.bsn'}}", label: 'Dutch BSN', description: 'Valid Dutch BSN (9 digits, 11-proof)' },
      { expression: "{{random 'IdNumber.valid'}}", label: 'SSN (US)', description: 'US Social Security Number' },
      { expression: "{{random 'IdNumber.validSvSeSsn'}}", label: 'SSN (Swedish)', description: 'Swedish personnummer' },
      { expression: "{{random 'IdNumber.singaporeanFin'}}", label: 'FIN (Singapore)', description: 'Singaporean FIN' },
    ],
  },
];
