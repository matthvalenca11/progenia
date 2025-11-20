import { supabase } from "@/integrations/supabase/client";

export interface Quiz {
  id?: string;
  title: string;
  description?: string;
  lesson_id?: string;
  passing_score?: number;
  time_limit_minutes?: number;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QuizQuestion {
  id?: string;
  quiz_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  points?: number;
  order_index?: number;
  explanation?: string;
  created_at?: string;
}

export interface QuizOption {
  id?: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean;
  order_index?: number;
  created_at?: string;
}

export interface QuizAttempt {
  id?: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  passed: boolean;
  answers?: any;
  started_at?: string;
  completed_at?: string;
}

export const quizService = {
  // Quiz CRUD
  async getAllQuizzes(): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getQuizzesByLesson(lessonId: string): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("is_published", true);

    if (error) throw error;
    return data || [];
  },

  async getQuizById(quizId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();

    if (error) throw error;
    return data;
  },

  async createQuiz(quiz: Omit<Quiz, "id" | "created_at" | "updated_at">): Promise<Quiz> {
    const { data, error } = await supabase
      .from("quizzes")
      .insert(quiz)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQuiz(quizId: string, updates: Partial<Quiz>): Promise<Quiz> {
    const { data, error } = await supabase
      .from("quizzes")
      .update(updates)
      .eq("id", quizId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteQuiz(quizId: string): Promise<void> {
    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
    if (error) throw error;
  },

  // Questions CRUD
  async getQuestionsByQuiz(quizId: string): Promise<QuizQuestion[]> {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return (data || []) as QuizQuestion[];
  },

  async createQuestion(question: Omit<QuizQuestion, "id" | "created_at">): Promise<QuizQuestion> {
    const { data, error } = await supabase
      .from("quiz_questions")
      .insert(question)
      .select()
      .single();

    if (error) throw error;
    return data as QuizQuestion;
  },

  async updateQuestion(questionId: string, updates: Partial<QuizQuestion>): Promise<QuizQuestion> {
    const { data, error } = await supabase
      .from("quiz_questions")
      .update(updates)
      .eq("id", questionId)
      .select()
      .single();

    if (error) throw error;
    return data as QuizQuestion;
  },

  async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId);
    if (error) throw error;
  },

  // Options CRUD
  async getOptionsByQuestion(questionId: string): Promise<QuizOption[]> {
    const { data, error } = await supabase
      .from("quiz_options")
      .select("*")
      .eq("question_id", questionId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createOption(option: Omit<QuizOption, "id" | "created_at">): Promise<QuizOption> {
    const { data, error } = await supabase
      .from("quiz_options")
      .insert(option)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOption(optionId: string, updates: Partial<QuizOption>): Promise<QuizOption> {
    const { data, error } = await supabase
      .from("quiz_options")
      .update(updates)
      .eq("id", optionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOption(optionId: string): Promise<void> {
    const { error } = await supabase.from("quiz_options").delete().eq("id", optionId);
    if (error) throw error;
  },

  // Attempts
  async submitAttempt(attempt: Omit<QuizAttempt, "id" | "started_at" | "completed_at">): Promise<QuizAttempt> {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .insert(attempt)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getUserAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .order("completed_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get full quiz with questions and options
  async getFullQuiz(quizId: string): Promise<Quiz & { questions: (QuizQuestion & { options: QuizOption[] })[] }> {
    const quiz = await this.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");

    const questions = await this.getQuestionsByQuiz(quizId);
    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => ({
        ...q,
        options: await this.getOptionsByQuestion(q.id!),
      }))
    );

    return { ...quiz, questions: questionsWithOptions };
  },
};
