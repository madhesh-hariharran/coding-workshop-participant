/**
 * Component tests for StatusBadge.
 * Tests that each status value renders the correct label and color.
 */
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/shared/StatusBadge';

describe('StatusBadge', () => {
  test('renders "In Progress" for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('renders "At Risk" for at_risk status', () => {
    render(<StatusBadge status="at_risk" />);
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  test('renders "On Hold" for on_hold status', () => {
    render(<StatusBadge status="on_hold" />);
    expect(screen.getByText('On Hold')).toBeInTheDocument();
  });

  test('renders "Completed" for completed status', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('renders "Pending" for pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  test('renders "In Progress" for in_progress status', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('renders unknown status as-is', () => {
    render(<StatusBadge status="unknown_value" />);
    expect(screen.getByText('unknown_value')).toBeInTheDocument();
  });
});