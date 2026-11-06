import { CategoryType } from '@models/category.model';
import { CATEGORY_COLORS } from '@shared/utils/category.utils';

/** One suggested parent and the subcategories that inherit its type, color and icon. */
export interface StarterParent {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  subcategories: string[];
}

const [BLUE, GREEN, PURPLE, ORANGE, PINK, TEAL, INDIGO, RED, YELLOW, CYAN] = CATEGORY_COLORS;

/** The suggested tree offered on an empty Categories page, in display order. */
export const STARTER_CATEGORIES: readonly StarterParent[] = [
  {
    name: 'Income',
    type: CategoryType.INCOME,
    color: GREEN,
    icon: 'pi-briefcase',
    subcategories: [
      'Salary',
      'Interest',
      'Investment income',
      'Refunds and reimbursements',
      'Other income',
    ],
  },
  {
    name: 'Housing',
    type: CategoryType.EXPENSE,
    color: INDIGO,
    icon: 'pi-home',
    subcategories: [
      'Rent or mortgage',
      'Property tax',
      'Home insurance',
      'Maintenance and repairs',
      'Furnishings',
    ],
  },
  {
    name: 'Utilities',
    type: CategoryType.EXPENSE,
    color: YELLOW,
    icon: 'pi-bolt',
    subcategories: [
      'Electricity',
      'Gas and heating',
      'Water and sewer',
      'Internet',
      'Mobile phone',
    ],
  },
  {
    name: 'Food',
    type: CategoryType.EXPENSE,
    color: ORANGE,
    icon: 'pi-shopping-cart',
    subcategories: ['Groceries', 'Dining out', 'Coffee and snacks', 'Takeout and delivery'],
  },
  {
    name: 'Transportation',
    type: CategoryType.EXPENSE,
    color: BLUE,
    icon: 'pi-car',
    subcategories: [
      'Fuel',
      'Public transit',
      'Car insurance',
      'Parking and tolls',
      'Car maintenance',
    ],
  },
  {
    name: 'Health',
    type: CategoryType.EXPENSE,
    color: PINK,
    icon: 'pi-heart',
    subcategories: [
      'Doctor and dental',
      'Pharmacy',
      'Health insurance',
      'Vision and eye care',
      'Fitness',
    ],
  },
  {
    name: 'Shopping',
    type: CategoryType.EXPENSE,
    color: PURPLE,
    icon: 'pi-tag',
    subcategories: ['Clothing', 'Electronics', 'Household items', 'Personal care'],
  },
  {
    name: 'Entertainment',
    type: CategoryType.EXPENSE,
    color: CYAN,
    icon: 'pi-ticket',
    subcategories: ['Movies and events', 'Hobbies', 'Travel', 'Games', 'Sports'],
  },
  {
    name: 'Subscriptions',
    type: CategoryType.EXPENSE,
    color: TEAL,
    icon: 'pi-desktop',
    subcategories: ['Streaming', 'Software and apps', 'Memberships', 'News and magazines'],
  },
  {
    name: 'Education',
    type: CategoryType.EXPENSE,
    color: INDIGO,
    icon: 'pi-book',
    subcategories: ['Tuition', 'Books and supplies', 'Courses'],
  },
  {
    name: 'Debt and fees',
    type: CategoryType.EXPENSE,
    color: RED,
    icon: 'pi-money-bill',
    subcategories: ['Credit card interest', 'Loan payment', 'Bank fees', 'Late fees'],
  },
  {
    name: 'Giving and family',
    type: CategoryType.EXPENSE,
    color: PINK,
    icon: 'pi-gift',
    subcategories: ['Charity', 'Gifts', 'Childcare', 'Pets'],
  },
  {
    name: 'Taxes',
    type: CategoryType.EXPENSE,
    color: YELLOW,
    icon: 'pi-shield',
    subcategories: ['Income tax', 'Tax preparation', 'Other taxes'],
  },
  {
    name: 'Transfers',
    type: CategoryType.TRANSFER,
    color: BLUE,
    icon: 'pi-wallet',
    subcategories: ['Credit card payment', 'Savings transfer', 'Account transfer'],
  },
];
