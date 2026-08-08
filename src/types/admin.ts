export interface TaskFieldInput {
  title: string;
  description?: string;
  field_type: "text" | "number" | "email" | "url" | "image" | "screenshot" | "video" | "file" | "telegram" | "whatsapp";
  is_required?: boolean;
  placeholder?: string;
  max_size?: number;
  sort_order?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  amount: number;
  plan_id: string | null;
  category_id?: string;
  icon?: string;
  estimated_time?: number;
  instructions?: string;
  link?: string;
  max_completions?: number;
  duration_minutes?: number;
  deadline?: string;
  validation_type: "auto" | "manual";
  fields?: TaskFieldInput[];
}