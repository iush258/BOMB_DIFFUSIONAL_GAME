const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === ',' && !insideQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  return rows;
};

const normalizeHeader = (value) => value.replace(/^\uFEFF/, '').trim().toLowerCase();

export const importTeamsCsv = (text) => {
  const rows = parseCsvRows(text);
  if (rows.length === 0 || rows[0].length !== 1 || normalizeHeader(rows[0][0]) !== 'name') {
    throw new Error("Team CSV must contain exactly one column named 'Name'.");
  }

  const teams = [...new Set(rows.slice(1).map((row) => row[0]).filter(Boolean))];
  if (teams.length === 0) throw new Error('Team CSV does not contain any team names.');
  return teams;
};

export const importQuestionsCsv = (text) => {
  const rows = parseCsvRows(text);
  const expectedHeaders = ['question', 'type', 'option a', 'option b', 'option c', 'option d', 'correct answer'];
  const headers = rows[0]?.map(normalizeHeader);

  if (!headers || headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error("Question CSV must contain: Question,Type,Option A,Option B,Option C,Option D,Correct Answer.");
  }

  const questions = rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const [question, typeValue, optionA, optionB, optionC, optionD, correctAnswer] = row;
    const type = typeValue.toLowerCase();

    if (!question) throw new Error(`Question CSV row ${rowNumber} has no question text.`);
    if (type !== 'mcq' && type !== 'text') {
      throw new Error(`Question CSV row ${rowNumber} must use Type 'mcq' or 'text'.`);
    }
    if (!correctAnswer) throw new Error(`Question CSV row ${rowNumber} has no correct answer.`);

    if (type === 'text') {
      return { id: `q_${Date.now()}_${index}`, type, question, correctAnswer };
    }

    const options = [optionA, optionB, optionC, optionD].filter(Boolean);
    if (options.length < 2) throw new Error(`Question CSV row ${rowNumber} needs at least two options.`);
    const answerByLetter = { a: optionA, b: optionB, c: optionC, d: optionD };
    const selectedAnswer = answerByLetter[correctAnswer.toLowerCase()] || correctAnswer;
    if (!options.includes(selectedAnswer)) {
      throw new Error(`Question CSV row ${rowNumber} has a correct answer that is not one of its options.`);
    }

    return { id: `q_${Date.now()}_${index}`, type, question, options, correctAnswer: selectedAnswer };
  });

  if (questions.length === 0) throw new Error('Question CSV does not contain any questions.');
  return questions;
};
