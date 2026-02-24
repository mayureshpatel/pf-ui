import {User} from '@models/auth.model';

export interface Merchant {
  id: number;
  user: User;
  originalName: string;
  cleanName: string;
}
