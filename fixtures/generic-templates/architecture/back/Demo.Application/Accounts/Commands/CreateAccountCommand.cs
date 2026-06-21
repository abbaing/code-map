namespace Demo.Application.Accounts.Commands;

public record CreateAccountCommand(string Name) : ICommand;
