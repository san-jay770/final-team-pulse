/**
 * TEAM PULSE — Excel Export Utilities
 * Helper functions to style ExcelJS worksheets with beautiful headers, borders, colors, and auto column sizing.
 */

const ExcelJS = require('exceljs');

const COLORS = {
  headerBg: '4F46E5',    // Indigo primary
  headerText: 'FFFFFF',
  subHeaderBg: '1E293B', // Slate dark
  border: 'E2E8F0',
  zebraBg: 'F8FAFC',
  successBg: 'DCFCE7',
  successText: '166534',
  warningBg: 'FEF3C7',
  warningText: '92400E',
  dangerBg: 'FEE2E2',
  dangerText: '991B1B',
  infoBg: 'E0E7FF',
  infoText: '3730A3',
};

/**
 * Creates a standard styled Excel Workbook
 */
function createStyledWorkbook(title = 'Team Pulse Report') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Team Pulse';
  workbook.lastModifiedBy = 'Team Pulse System';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

/**
 * Applies header styling to a specific row
 */
function styleHeaderRow(row, bgColor = COLORS.headerBg) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { argb: '0F172A' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
  });
}

/**
 * Styles data rows with alternating zebra backgrounds, thin borders, and proper padding
 */
function styleDataRows(worksheet, startRowIndex = 2) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= startRowIndex) {
      row.height = 22;
      const isEven = rowNumber % 2 === 0;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: '1E293B' } };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.zebraBg }
          };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } },
        };
        if (!cell.alignment) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    }
  });
}

/**
 * Auto-adjust column widths based on cell text lengths with min and max bounds
 */
function autoFitColumns(worksheet, minWidth = 12, maxWidth = 45) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      let len = 0;
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && val.text) {
          len = val.text.toString().length;
        } else {
          len = val.toString().length;
        }
      }
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(Math.max(maxLen + 4, minWidth), maxWidth);
  });
}

/**
 * Adds a stylized Title banner to the top of a worksheet
 */
function addTitleBanner(worksheet, title, subtitle = '', columnSpan = 'F') {
  worksheet.mergeCells(`A1:${columnSpan}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 32;

  if (subtitle) {
    worksheet.mergeCells(`A2:${columnSpan}2`);
    const subCell = worksheet.getCell('A2');
    subCell.value = subtitle;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 22;
  }
}

module.exports = {
  COLORS,
  createStyledWorkbook,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  addTitleBanner,
};
