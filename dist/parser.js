"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCodeParser = void 0;
const WORD_RE = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class GCodeParser {
    parseLine(line) {
        const comments = [];
        const stripped = this.stripComments(line, comments);
        const words = this.parseWords(stripped);
        const gcodes = words.filter((word) => {
            const letter = word.letter.toUpperCase();
            return letter === "G" || letter === "M";
        });
        const params = words.filter((word) => {
            const letter = word.letter.toUpperCase();
            return letter !== "G" && letter !== "M";
        });
        return {
            raw: line,
            words,
            gcodes,
            params,
            comments,
        };
    }
    stripComments(line, comments) {
        let result = "";
        let inParen = false;
        let commentStart = -1;
        let commentBuffer = "";
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (!inParen && ch === ";") {
                const text = line.slice(i + 1);
                comments.push({ type: "semicolon", text, start: i, end: line.length });
                break;
            }
            if (ch === "(") {
                if (!inParen) {
                    inParen = true;
                    commentStart = i;
                    commentBuffer = "";
                }
                else {
                    commentBuffer += ch;
                }
                continue;
            }
            if (ch === ")" && inParen) {
                comments.push({
                    type: "paren",
                    text: commentBuffer,
                    start: commentStart,
                    end: i + 1,
                });
                inParen = false;
                commentStart = -1;
                commentBuffer = "";
                continue;
            }
            if (inParen) {
                commentBuffer += ch;
                continue;
            }
            result += ch;
        }
        if (inParen) {
            comments.push({
                type: "paren",
                text: commentBuffer,
                start: commentStart,
                end: line.length,
            });
        }
        return result;
    }
    parseWords(line) {
        const words = [];
        for (const match of line.matchAll(WORD_RE)) {
            const raw = match[0];
            const letter = match[1].toUpperCase();
            const value = Number(match[2]);
            const start = match.index ?? 0;
            const end = start + raw.length;
            words.push({ letter, value, raw, start, end });
        }
        return words;
    }
}
exports.GCodeParser = GCodeParser;
