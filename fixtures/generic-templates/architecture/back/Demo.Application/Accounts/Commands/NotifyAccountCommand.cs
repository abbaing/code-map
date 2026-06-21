namespace Demo.Application.Accounts.Commands;

public record NotifyAccountCommand(string AccountId) : ICommand;
