export type ChessStudent = {
  id: string;
  school_slug: string;
  name: string;
  grade: string;
  rank: number;
  strength: string;
  note: string;
  avatar_image?: string;
};

export type ChessSchool = {
  slug: string;
  name: string;
  city: string;
  coordinator: string;
  summary: string;
};

export type ChessSchoolDetail = {
  school: ChessSchool;
  students: ChessStudent[];
};
