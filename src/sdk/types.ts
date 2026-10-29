export interface SdkBounty {
  id: number;
  contract_id?: string;
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
  funded_amount: number;
  status: 'open' | 'funded' | 'completed' | 'settled' | 'cancelled';
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface SdkMilestone {
  id: number;
  bounty_id: number;
  description: string;
  reward_amount: number;
  recipient_address: string;
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'paid' | 'rejected';
  approvals: number;
  rejections: number;
  approval_threshold: number;
}

export interface SdkSettlement {
  id: number;
  bounty_id: number;
  milestone_id: number;
  total_amount: number;
  recipients: Array<{ recipient: string; amount: number; percentage_bps?: number }>;
  status: 'pending' | 'authorized' | 'executing' | 'settled' | 'failed';
}

export interface SdkTreasuryStats {
  total_funds: number;
  total_bounties: number;
  active_bounties: number;
  completed_bounties: number;
  pending_milestones: number;
  pending_settlements: number;
  total_distributed: number;
}
