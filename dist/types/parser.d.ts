import { ParsedLine } from "./types";
export declare class GCodeParser {
    parseLine(line: string): ParsedLine;
    private stripComments;
    private parseWords;
}
